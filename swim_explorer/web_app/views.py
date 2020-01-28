"""
Copyright 2019 EUROCONTROL
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
import logging
import os
from functools import partial
from typing import List, Dict, Any

from flask import send_from_directory, Blueprint, current_app as app

from swim_explorer import cache
from swim_explorer.subscription_manager import handle_sm_response, get_topics, swim_subscriber_message_consumer, \
    get_subscriptions

__author__ = "EUROCONTROL (SWIM)"


_logger = logging.getLogger(__name__)


def _get_folder(name):
    current_dir = os.path.dirname(os.path.realpath(__file__))
    return os.path.join(current_dir, name)


explorer_blueprint = Blueprint('explorer',
                               __name__,
                               template_folder='templates',
                               static_folder='static')


########
# STATIC
########

@explorer_blueprint.route("/")
def index():
    return send_from_directory('web_app/templates/', "index.html")


@explorer_blueprint.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('web_app/static/js', path)


@explorer_blueprint.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('web_app/static/css', path)


@explorer_blueprint.route('/img/<path:path>')
def send_img(path):
    return send_from_directory('web_app/static/img', path)


@explorer_blueprint.route('/favicon.ico')
def favicon():
    return send_from_directory('web_app/static/img', 'airplane.png', mimetype='image/png')


#####
# API
#####

@explorer_blueprint.route("/init")
@handle_sm_response
def init() -> Dict[str, Any]:
    """
    Retrieves existing Topic names (to be used on first load of the page)
    :return:
    """
    topics = get_topics()
    subscriptions = get_subscriptions()

    subscribed_topics = [subscription.topic for subscription in subscriptions]
    not_subscribed_topics = [topic for topic in topics if topic not in subscribed_topics]

    return {
        'subscriptions': [
            {
                'id': subscription.id,
                'topic': subscription.topic.name,
                'active': subscription.active
            }
            for subscription in subscriptions
        ],
        'topics': [
            {
                'id': topic.id,
                'name': topic.name
            }
            for topic in not_subscribed_topics
        ],
        'polling_interval': app.config['POLLING_INTERVAL_IN_SEC'] * 1000
    }


@explorer_blueprint.route("/subscribe/<topic>")
@handle_sm_response
def subscribe(topic: str) -> Dict[str, Any]:
    """
    Creates a new subscription in the Subscription Manager
    :param topic:
    :return:
    """
    subscription = app.swim_subscriber.subscribe(
        topic_name=topic,
        message_consumer=partial(swim_subscriber_message_consumer, topic=topic)
    )

    _logger.info(f"Subscribed to queue: {subscription.queue}")

    # keep the subscription id in memory
    cache.save_subscription(topic, subscription)

    return {
        'id': subscription.id,
        'queue': subscription.queue,
        'active': subscription.active,
        'topic': topic
    }


@explorer_blueprint.route("/unsubscribe/<topic>")
@handle_sm_response
def unsubscribe(topic: str) -> dict:
    """
    Deletes the subscription in Subscription Manager

    :param topic:
    :return:
    """
    subscription = cache.delete_subscription(topic)

    app.swim_subscriber.unsubscribe(subscription)

    return {}


@explorer_blueprint.route("/pause/<topic>")
@handle_sm_response
def pause(topic: str) -> dict:
    """
    Pauses the subscription in Subscription Manager

    :param topic:
    :return:
    """
    subscription = cache.get_subscription(topic)

    subscription = app.swim_subscriber.pause(subscription)

    cache.save_subscription(topic, subscription)

    return {'active': subscription.active}


@explorer_blueprint.route("/resume/<topic>")
@handle_sm_response
def resume(topic: str) -> Dict[str, List[Dict]]:
    """
    Resumes the subscription in Subscription Manager

    :param topic:
    :return:
    """
    subscription = cache.get_subscription(topic)

    subscription = app.swim_subscriber.resume(subscription)

    cache.save_subscription(topic, subscription)

    return {'active': subscription.active}


@explorer_blueprint.route("/poll")
def poll():
    """
    Removes the first item in the queue of messages that are kept in memory and returns it
    :return:
    """
    return cache.remove_queue_message()
