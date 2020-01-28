"""
Copyright 2020 EUROCONTROL
==========================================

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

==========================================

Editorial note: this license is an instance of the BSD license template as provided by the Open Source Initiative:
http://opensource.org/licenses/BSD-3-Clause

Details on EUROCONTROL: http://www.eurocontrol.int
"""

__author__ = "EUROCONTROL (SWIM)"

import json
import logging
from functools import wraps, partial
from typing import List

import proton
from flask import current_app
from pubsub_facades.swim_pubsub import SWIMSubscriber
from subscription_manager_client.models import Topic, Subscription
from subscription_manager_client.subscription_manager import SubscriptionManagerClient
from rest_client.errors import APIError
from swim_backend.local import AppContextProxy

from swim_explorer import cache

_logger = logging.getLogger(__name__)


def _get_sm_client():
    return SubscriptionManagerClient.create(
        host=current_app.config['SUBSCRIPTION-MANAGER-API']['host'],
        https=current_app.config['SUBSCRIPTION-MANAGER-API']['https'],
        timeout=current_app.config['SUBSCRIPTION-MANAGER-API']['timeout'],
        verify=current_app.config['SUBSCRIPTION-MANAGER-API']['verify'],
        username=current_app.config['SUBSCRIPTION-MANAGER-API']['username'],
        password=current_app.config['SUBSCRIPTION-MANAGER-API']['password']
    )


sm_client: SubscriptionManagerClient = AppContextProxy(_get_sm_client)


def swim_subscriber_message_consumer(message: proton.Message, topic: str):
    _logger.info(f"Received message: {message.body}")
    cache.add_queue_message({'data': json.loads(message.body), 'topic': topic})


def get_topics() -> List[Topic]:
    return sm_client.get_topics()


def get_subscriptions() -> List[Subscription]:
    return sm_client.get_subscriptions()


def handle_sm_response(f):
    @wraps(f)
    def decorator(*args, **kwargs):
        try:
            response = f(*args, **kwargs)

            if response is None:
                response = {}

            response['status'] = 'OK'
        except APIError as e:
            _logger.error(str(e))
            response = {
                'status': 'NOK',
                'error': e.detail
            }
        except Exception as e:
            _logger.error(str(e))
            response = {
                'status': 'NOK',
                'error': str(e)
            }
        return response
    return decorator


def preload_swim_subscriber(subscriber: SWIMSubscriber):
    """
    Fetches the existing subscriptions and creates the necessary AMQP1.0 receivers on their queues
    NOTE: to be used upon app initialization
    :param subscriber:
    """
    subscriptions = get_subscriptions()

    for subscription in subscriptions:

        # keep the subscription id in memory
        cache.save_subscription(topic=subscription.topic.name, subscription=subscription)

        subscriber.preload_queue_message_consumer(
            queue=subscription.queue,
            message_consumer=partial(swim_subscriber_message_consumer,
                                     topic=subscription.topic.name)
        )

        _logger.info(f'Added message_consumer for queue {subscription.queue}')
