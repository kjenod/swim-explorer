
"use strict"

class Topic {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
}

class Subscription {
    constructor(id, topic, active) {
        this.id = id;
        this.topic = topic;
        this.active = active;
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
        self = this;
        $.ajax({
                type: "GET",
                url: "/subscribe/" + topic.name,
                dataType : "json",
                contentType: "application/json; charset=utf-8",
                success : function(result) {

                    if (result.status == 'NOK') {
                        console.log(result.error)
                        showError("Failed to subscribe");
                    }
                    else {
                        subscriptionsList.add(new Subscription(result.id, result.topic, result.active));
                        self.remove(topic);
                    }
                },
            });
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
  template: '<li class="subscriptions-item list-group-item justify-content-between align-items-center list-group-item-light">' +
                '<div class="row">' +
                        '<div class="btn-group" role="group" aria-label="Actions">' +
                          '<button type="button" class="btn btn-light" v-on:click="pauseResume(subscription)">' +
                            '<i v-if="subscription.loading" class="fas fa-spinner fa-spin trash" title="Loading..."></i>' +
                            '<i v-else="subscription.loading" class="fas fa-pause play-pause" title="Pause" ref="playPause"></i>' +
                          '</button>' +
                          '<button type="button" class="btn btn-light" v-on:click="unsubscribe(subscription)">' +
                            '<i class="fas fa-sign-out-alt" title="Unsubscribe"></i>' +
                          '</button>' +
                          '<button type="button" class="btn btn-light" ref="subscriptionText" v-on:mousedown="highlight(subscription)" v-on:mouseup="unhighlight(subscription)">{{ subscription.topic }}</button>' +
                    '</div>' +
                '</div>' +
            '</li>',
    methods: {
        unsubscribe: function(subscription) {

            $.ajax({
                type: "GET",
                url: "/unsubscribe/" + subscription.topic,
                dataType : "json",
                contentType: "application/json; charset=utf-8",
                success : function(result) {
                    if (result.status == 'NOK') {
                        console.log(result.error)
                        showError("Failed to unsubscribe");
                    }
                    else {
                        topicsList.add(new Topic(subscription.id, subscription.topic))
                        subscriptionsList.remove(subscription)

                        subscription.airplanes.forEach((airplane) => airplane.remove());
                    }
                },
            });
        },
        pauseResume: function(subscription) {
            self = this;
            if (subscription.active) {
                $.ajax({
                    type: "GET",
                    url: "/pause/" + subscription.topic,
                    dataType : "json",
                    contentType: "application/json; charset=utf-8",
                    success : function(result) {
                        if (result.status == 'NOK') {
                            console.log(result.error)
                            showError("Failed to pause subscription");
                        }
                        else {
                            subscription.active = result.active;
                            self.$refs.playPause.classList.remove('fa-pause')
                            self.$refs.playPause.classList.add('fa-play')
                            self.$refs.playPause.title = 'Resume';

                            subscription.airplanes.forEach((airplane) => airplane.pause());
                        }
                    },
                });
            }
            else {
                $.ajax({
                    type: "GET",
                    url: "/resume/" + subscription.topic,
                    dataType : "json",
                    contentType: "application/json; charset=utf-8",
                    success : function(result) {
                        if (result.status == 'NOK') {
                            console.log(result.error)
                            showError("Failed to resume subscription");
                        }
                        else {
                            subscription.active = result.active;
                            self.$refs.playPause.classList.remove('fa-play')
                            self.$refs.playPause.classList.add('fa-pause')
                            self.$refs.playPause.title = 'Pause';

                            subscription.airplanes.forEach((airplane) => airplane.resume());
                        }
                    },
                });
            }
        },
        highlight: function(subscription) {
            subscription.airplanes.forEach((airplane) => airplane.highlight());
        },
        unhighlight: function(subscription) {
            subscription.airplanes.forEach((airplane) => {
                subscription.active ? airplane.resume() : airplane.pause();
            });
        }
    }
})

var subscriptionsList = new Vue({
    el: '#subscriptions-list',
    data: {
        subscriptions: []
    },
    methods: {
        add: function(subscription){
            this.subscriptions.push(subscription)
        },
        remove: function(subscription) {
            this.subscriptions.splice(this.subscriptions.indexOf(subscription), 1)
        },
        topicMatchesActiveSubscription: function(topic) {
            var activeSubscriptions = this.subscriptions.filter((sub) => sub.active);

            return activeSubscriptions.map((sub) => sub.topic).includes(topic);
        },
        getSubscriptionByTopic: function(topic) {
            return this.subscriptions.filter((sub) => sub.topic == topic)[0];
        }
    }
})


function showError(errorText) {
    $("#errorModal").find(".modal-body").html("<p>" + errorText + "</p>");
    $("#errorModal").modal('toggle');
}


$(document).ready(function(){
    $("#myInput").on("keyup", function() {
        var value = $(this).val().toLowerCase();
        $("#topics-list a").filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
        });
    });


    $.ajax({
        type: "GET",
        url: "/init",
        dataType : "json",
        contentType: "application/json; charset=utf-8",
        success : function(result) {
            if (result.status == 'NOK') {
                console.log(result.error)
                showError("Failed to load Topics");
            }
            else {
                if (!topicsList.topics.length > 0) {
                    result.topics.forEach(function(topic) {
                        topicsList.add(new Topic(topic.id, topic.name))
                    })
                }
            }

            // setup polling
            setInterval(
                function(){
                    $.ajax({
                        type: "GET",
                        url: "/poll",
                        dataType : "json",
                        contentType: "application/json; charset=utf-8",
                        success : function(result) {

                            var subscription = subscriptionsList.getSubscriptionByTopic(result.topic)

                            if (!subscription || !subscription.active) {
                                return;
                            }

                            subscription.refreshFlights(result.data);
                        },
                    });
                },
                result.polling_interval
            );
        },
    });
});

