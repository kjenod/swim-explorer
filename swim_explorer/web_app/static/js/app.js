
"use strict"

class Topic {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
}

class Subscription {
    constructor(id, topic) {
        this.id = id;
        this.topic = topic;
        this.paused = false;
        this.loading = true;
        this.airplanes = [];
    }

    refreshFlights(flightData) {
        flightData.forEach((airplaneData) => {
            if (!airplaneData.lat || !airplaneData.lng){
                return;
            }

            var airplane = this.airplanes.find((airplane) => airplane.icao24 == airplaneData.icao24);

            if (airplane) {
                airplane.move(airplaneData.lat, airplaneData.lng, airplaneData.last_contact);
            }
            else {
                var newAirplane = new Airplane(
                    airplaneData.icao24,
                    airplaneData.lat,
                    airplaneData.lng,
                    airplaneData.from,
                    airplaneData.to,
                    airplaneData.last_contact)

                this.airplanes.push(newAirplane);
            }
        });

        if (this.loading) {
            this.loading = false;
        }
    }
}

var topicsList = new Vue({
  el: '#topics-list',
  data: {
    topics: []
  },
  methods: {
    subscribeToTopic: function(topic) {
        socket.emit('subscribe', {topic: topic.name});
        subscriptionsList.add(new Subscription(topic.id, topic.name));
        this.remove(topic);
    },
    remove: function(topic) {
        this.topics.splice(this.topics.indexOf(topic), 1);
    },
    add: function(topic) {
        this.topics.push(topic);
        this.sort();
    },
    sort: function() {
        this.topics.sort((t1, t2) => (t1.name > t2.name ? 1 : -1));
    }
  }
})

Vue.component('subscription-item', {
  props: ['subscription'],
  template: '<li class="subscriptions-item list-group-item justify-content-between align-items-center list-group-item-success" title="Pause"' +
                'v-on:mouseenter="highlight(subscription)" ' +
                'v-on:mouseleave="unhighlight(subscription)">' +
                '<div class="row">' +
                    '<div class="col-10 subscriptions-item-name" v-on:click="pauseResume(subscription)">{{ subscription.topic }}</div>' +
                    '<div class="col-2">' +
                    '<i v-if="subscription.loading" class="fas fa-spinner fa-spin trash" title="Loading..."></i>' +
                    '<i v-else="subscription.loading" v-on:click="unsubscribe(subscription)" class="fas fa-trash trash" title="Unsubscribe"></i>' +
                    '</div>' +
                '</div>' +
            '</li>',
    methods: {
        unsubscribe: function(subscription) {
            socket.emit('unsubscribe', {topic: subscription.topic})

            topicsList.add(new Topic(subscription.id, subscription.topic))
            subscriptionsList.remove(subscription)

            subscription.airplanes.forEach((airplane) => airplane.remove());
        },
        pauseResume: function(subscription) {
            if (subscription.paused) {
                socket.emit('resume', {topic: subscription.topic})

                this.$el.classList.remove('list-group-item-danger');
                this.$el.classList.add('list-group-item-success');
                this.$el.title = 'Pause';

                subscription.paused = false;
                subscription.airplanes.forEach((airplane) => airplane.resume());
            }
            else {
                socket.emit('pause', {topic: subscription.topic})

                this.$el.classList.remove('list-group-item-success');
                this.$el.classList.add('list-group-item-danger');
                this.$el.title = 'Resume';

                subscription.paused = true;
                subscription.airplanes.forEach((airplane) => airplane.pause());
            }
        },
        highlight: function(subscription) {
            var classToRemove = subscription.paused ? 'list-group-item-danger' : 'list-group-item-success';

            this.$el.classList.remove(classToRemove);
            this.$el.classList.add('list-group-item-primary');

            subscription.airplanes.forEach((airplane) => airplane.highlight());
        },
        unhighlight: function(subscription) {
            var classToAdd = subscription.paused ? 'list-group-item-danger' : 'list-group-item-success';

            this.$el.classList.remove('list-group-item-primary');
            this.$el.classList.add(classToAdd);

            subscription.airplanes.forEach((airplane) => {
                subscription.paused ? airplane.pause() : airplane.resume();
            });
        }
    }
})

var subscriptionsList = new Vue({
    el: '#subscriptions-list',
    data: {
        subscriptions: [],
        footnoteSeen: false
    },
    methods: {
        updateFootnoteSeen: function() {
            this.footnoteSeen = this.subscriptions.length > 0;
        },
        add: function(subscription){
            this.subscriptions.push(subscription)
            this.updateFootnoteSeen()
        },
        remove: function(subscription) {
            this.subscriptions.splice(this.subscriptions.indexOf(subscription), 1)
            this.updateFootnoteSeen()
        },
        topicMatchesActiveSubscription: function(topic) {
            var activeSubscriptions = this.subscriptions.filter((sub) => !sub.paused);

            return activeSubscriptions.map((sub) => sub.topic).includes(topic);
        },
        getSubscriptionByTopic: function(topic) {
            return this.subscriptions.filter((sub) => sub.topic == topic)[0];
        }
    }
})


var socket = io.connect('http://localhost:5000');

socket.on('data', function (event) {
    var subscription = subscriptionsList.getSubscriptionByTopic(event.topic)

    if (!subscription || subscription.paused) {
        return;
    }

    subscription.refreshFlights(event.data);
});

socket.on('topics', function(event) {
    if (!topicsList.topics.length > 0) {
        event.topics.forEach(function(topicName, id) {
            topicsList.add(new Topic(id, topicName))
        })
    }
});

$(document).ready(function(){
  $("#myInput").on("keyup", function() {
    var value = $(this).val().toLowerCase();
    $("#topics-list a").filter(function() {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
    });
  });
});

