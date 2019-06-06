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
from collections import defaultdict
from functools import partial

from flask import request
from flask_socketio import join_room, leave_room

__author__ = "EUROCONTROL (SWIM)"


TOPIC_ROOMS = defaultdict(list)


def sub_handler(data, topic, sio):

    data['topic'] = topic
    sio.emit('data', data, room=topic)


def on_subscribe(data, sio, subscriber):
    topic = data['topic']

    if not TOPIC_ROOMS[topic]:
        subscriber.subscribe(topic, partial(sub_handler, topic=topic, sio=sio))

    join_room(topic, sid=request.sid)

    TOPIC_ROOMS[topic].append(request.sid)


def on_unsubscribe(data, subscriber):
    topic = data['topic']

    TOPIC_ROOMS[topic].remove(request.sid)

    leave_room(topic, sid=request.sid)

    if not TOPIC_ROOMS[topic]:
        subscriber.unsubscribe(topic)


def on_disconnect(subscriber):
    for topic, users in TOPIC_ROOMS.items():
        if request.sid in users:
            users.remove(request.sid)
            leave_room(topic, sid=request.sid)
            print(f"Removed {request.sid} from {topic}")

        if not TOPIC_ROOMS[topic]:
            subscriber.unsubscribe(topic)


def on_connect(sio, subscriber):
    topics = subscriber.get_topics()
    sio.emit('topics', {'topics': topics})
