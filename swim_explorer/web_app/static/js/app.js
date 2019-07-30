
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
        this.airplanes = [];
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
  template: '<li class="subscriptions-item list-group-item justify-content-between align-items-center list-group-item-success" title="Pause">'+
                '<div class="row">' +
                    '<div class="col-10 subscriptions-item-name" v-on:click="pauseResume(subscription)">{{ subscription.topic }}</div>' +
                    '<div class="col-2"><i v-on:click="unsubscribe(subscription)" class="fas fa-trash trash" data-topic="" title="Unsubscribe"></i></div>' +
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

function refreshFlights(flightData, topic) {
    if (!flightData.lat || !flightData.lng){
        return;
    }

    var subscription = subscriptionsList.getSubscriptionByTopic(topic)

    var airplane = subscription.airplanes.find((airplane) => airplane.icao24 == flightData.icao24);

    if (airplane) {
        airplane.move(flightData.lat, flightData.lng, flightData.last_contact);
    }
    else {
        var newAirplane = new Airplane(
            flightData.icao24,
            flightData.lat,
            flightData.lng,
            flightData.from,
            flightData.to,
            flightData.last_contact)

        subscription.airplanes.push(newAirplane);
    }

//    var airplane = airplanes.find((airplane) => airplane.icao24 == flightData.icao24);
//
//    if (airplane) {
//        airplane.move(flightData.lat, flightData.lng, flightData.last_contact);
//    }
//    else {
//        var newAirplane = new Airplane(
//            flightData.icao24,
//            flightData.lat,
//            flightData.lng,
//            flightData.from,
//            flightData.to,
//            flightData.last_contact)
//
//        airplanes.push(newAirplane);
//
//        if (!(topic in airplanesPerTopic)) {
//            airplanesPerTopic[topic] = []
//        }
//        airplanesPerTopic[topic].push(newAirplane);
//    }
}

var socket = io.connect('http://0.0.0.0:5000');

socket.on('data', function (event) {
    if (!subscriptionsList.topicMatchesActiveSubscription(event.topic)){
        return;
    }
    event.data.forEach((flightData) => refreshFlights(flightData, event.topic));
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

