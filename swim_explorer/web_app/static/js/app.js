
//var App = (function(self) {

    "use strict"

    var map = L.map('mapid');

    map.createPane('labels');

    // This pane is above markers but below popups
    map.getPane('labels').style.zIndex = 650;

    // Layers in this pane are non-interactive and do not obscure mouse/touch events
    map.getPane('labels').style.pointerEvents = 'none';


    var cartodbAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';

    var positron = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: cartodbAttribution
    }).addTo(map);

    var positronLabels = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
        attribution: cartodbAttribution,
        pane: 'labels'
    }).addTo(map);

    map.setView({ lat: 47.040182144806664, lng: 9.667968750000002 }, 5);

    var myIcon = L.icon({
        iconUrl: '/img/airplane.png',
        iconSize: [20, 20],
    });

    class Airplane {
        constructor(icao24, lat, lng, from, to, last_contact){
            this.icao24 = icao24;
            this.lat = lat;
            this.lng = lng;
            this.from = from;
            this.to = to;
            this.last_contact = this.getLastContactDateTime(last_contact);
            this.marker = L.marker([lat, lng], {icon: myIcon}).addTo(map);
            this.marker.bindPopup(this.getPopupContent());
        }

        getLastContactDateTime(secSinceEpoch) {
            var d = new Date(0);
            d.setUTCSeconds(secSinceEpoch);
            return d
        }

        getPopupContent() {
            return `<table class="table">
                      <thead class="thead-dark">
                        <tr>
                          <th scope="col"><h3>` + this.icao24 + `</h3></th>
                          <th scope="col"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">From</th>
                          <td>` + this.from + `</td>
                        </tr>
                        <tr>
                          <th scope="row">To</th>
                          <td>` + this.to + `</td>
                        </tr>
                        <tr>
                          <th scope="row">Latitude</th>
                          <td>` + this.lat + `</td>
                        </tr>
                        <tr>
                          <th scope="row">Longitude</th>
                          <td>` + this.lng + `</td>
                        </tr>
                        <tr>
                          <th scope="row">Last contact</th>
                          <td>` + this.dateFormat(this.last_contact) + `</td>
                        </tr>
                      </tbody>
                    </table>`;
        }

        dateFormat (date) {
            return date.toString().split('GMT')[0];
        }

        move(lat, lng, last_contact) {
            this.lat = lat;
            this.lng = lng;
            this.last_contact = this.getLastContactDateTime(last_contact);
            var latlng = L.latLng(lat, lng);
            this.marker.setLatLng(latlng);
            this.marker.getPopup().setContent(this.getPopupContent());
            if (!this.marker._map) {
                this.marker.addTo(map);
            }
        }
    }

    var airplanes = [];

    var airplanesPerTopic = {};

    var socket = io.connect('http://127.0.0.1:5000');

    function refresh_flights(flight_data, topic) {
        if (!flight_data.lat || !flight_data.lng){
            return;
        }

        var airplane = airplanes.find((airplane) => airplane.icao24 == flight_data.icao24);

        if (airplane) {
            airplane.move(flight_data.lat, flight_data.lng, flight_data.last_contact);
        }
        else {
            var newAirplaine = new Airplane(
                flight_data.icao24,
                flight_data.lat,
                flight_data.lng,
                flight_data.from,
                flight_data.to,
                flight_data.last_contact)

            airplanes.push(newAirplaine);

            if (!(topic in airplanesPerTopic)) {
                airplanesPerTopic[topic] = []
            }
            airplanesPerTopic[topic].push(newAirplaine);
        }
    }

    socket.on('data', function (event) {
        var topic = event.topic;
        var flight_data_list = event.data;

        flight_data_list.forEach((flight_data) => refresh_flights(flight_data, topic));
    });

    socket.on('topics', function(event) {
        var topics_ul = document.getElementById('topics');
        if (topics_ul.childElementCount > 1) {
            return;
        }

        event.topics.forEach(function(topic) {

            var item = document.createElement('li');
            item.className = "list-group-item justify-content-between align-items-center";
            item.innerHTML = `
                <div class="row">
                    <div class="col-10">` + topic + `</div>
                    <div class="col-2"><i class="fas fa-play play-pause" data-topic="` + topic + `"></i></div>
                </div>`;
            topics_ul.appendChild(item);
        })

        Array.from(document.getElementsByClassName('play-pause')).forEach(function(item) {
            item.onclick = onPlayPause;
        });
    });


    function onPlayPause(event) {
        var element = event.toElement;

        var topic = element.getAttribute('data-topic')
        // pause
        if (element.className.includes("fa-pause")){
            element.classList.remove("fa-pause")
            element.classList.add("fa-play")
            socket.emit('unsubscribe', {topic: topic});

            airplanesPerTopic[topic].forEach((airplane) => airplane.marker.remove());
        }
        // play
        else {
            element.classList.remove("fa-play")
            element.classList.add("fa-pause")
            socket.emit('subscribe', {topic: topic});
        }
    }

//	return self;
//}(App || {}));
