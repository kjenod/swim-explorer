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
import os
from functools import partial

from flask import Flask
from flask_socketio import SocketIO
from swim_pubsub.subscriber.subscriber import SubscriberApp

from swim_explorer.web_app.views import explorer_blueprint
from swim_explorer.socketio_handlers import on_subscribe, on_unsubscribe, on_connect, on_disconnect

__author__ = "EUROCONTROL (SWIM)"


def create_subscriber_app() -> SubscriberApp:
    current_dir = os.path.dirname(os.path.realpath(__file__))
    app = SubscriberApp(os.path.join(current_dir, 'config.yml'))

    while not app.is_running():
        pass

    return app

# the subscriber app that gets data from the broker and interacts with subscription manager
subscriber_app = create_subscriber_app()


# the web app that renders the frontend
flask_app = Flask(__name__)
flask_app.register_blueprint(explorer_blueprint)


# the SocketIO that sits in between the frontend and backend and redirects the data coming from the broker to the
# frontend via socket.io
sio = SocketIO(flask_app)
sio.on_event('subscribe', partial(on_subscribe, sio=sio, sub_app=subscriber_app))
sio.on_event('unsubscribe', partial(on_unsubscribe, sub_app=subscriber_app))
sio.on_event('connect', partial(on_connect, sio=sio, sub_app=subscriber_app))
sio.on_event('disconnect', partial(on_disconnect, sub_app=subscriber_app))


if __name__ == '__main__':
    sio.run(flask_app)
