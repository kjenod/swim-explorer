
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

var activeAirplaneIcon = L.icon({
    iconUrl: '/img/green.png',
    iconSize: [10, 10],
});

var inactiveAirplaneIcon = L.icon({
    iconUrl: '/img/red.png',
    iconSize: [10, 10],
});

var highlightedAirplaneIcon = L.icon({
    iconUrl: '/img/blue2.png',
    iconSize: [10, 10],
});

class Airplane {
    constructor(icao24, lat, lng, from, to, last_contact){
        this.icao24 = icao24;
        this.lat = lat;
        this.lng = lng;
        this.from = from;
        this.to = to;
        this.last_contact = this.getLastContactDateTime(last_contact);
        this.marker = L.marker([lat, lng], {icon: activeAirplaneIcon}).addTo(map);
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

    pause() {
        this.marker.setIcon(inactiveAirplaneIcon);
    }

    resume() {
        this.marker.setIcon(activeAirplaneIcon);
    }

    remove() {
        this.marker.remove();
    }

    highlight() {
        this.marker.setIcon(highlightedAirplaneIcon);
    }
}
