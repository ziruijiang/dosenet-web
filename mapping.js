var map; // Google Map Object
var berkeley = [37.872269, -122.258901];
var markers = [];
var bounds = new google.maps.LatLngBounds();
var json_vals = [];
var markerCluster;
var marks = [];
var infowindow = new google.maps.InfoWindow();
// url for geoJSON file
var url = '/sites/default/files/output.geojson?'
	+ Math.random().toString(36).replace(/[^a-z]+/g, ''); // To solve browser caching issue
var json = $($.parseJSON(JSON.stringify($.getJSON(url))));
var parsed_json = '';
var time = '';
var dose = '';
var dosimeter_name = '';
var graph_url = '';
var selected_marker = '';
var selected_val = '';
var unitMap = new Map();

function centerMap(center){
	var mapCenter = new google.maps.LatLng(center[0], center[1]);
	map.setCenter(mapCenter);
}

// These two functions should be temporary until this can be done in makeGeoJSON as we phase out plot.ly
function getURL(val){
	var csv = val.properties["csv_location"];
	var url;
	url = '/sites/default/files/dosenet/' + csv + '?'
	  + Math.random().toString(36).replace(/[^a-z]+/g, ''); // To solve browser caching issue
	return url;
}

function getName(val){
	var name = val.properties["Name"];
	return name;
}

function getTZ(val){
	var tz = val.properties["timezone"];
	return tz;
}

function updateInfowindowContent(val){
	time = getTimeframe();
	dose = getDoseUnit();
	url = getURL(val);
	name = getName(val);
	timezone = getTZ(val);

	var node_name = dose + '_' + time + '_' + name;
	//var content_string = '<div id="' + node_name + '"" style="max-width:500px; max-height=400px"><div id="graph_div"></div></div>';
	var content_string = '<div id="graph_wrapper_div"><div id="graph_div"></div></div>';
	get_data(url.toString(),name.toString(),timezone,dose,time,"graph_div");
	return content_string;
}

// Time units for a plot, called in updateInfowindowContent
function getTimeframe(){
	infowindow.close();
	var sel_time = document.getElementById('time_dropdown');
	return sel_time.options[sel_time.selectedIndex].value;
}

// Dose units for a plot, called in updateInfowindowContent
function getDoseUnit(){
	var sel = document.getElementById('dose_dropdown');
	return sel.options[sel.selectedIndex].value;
}

function clearMarkers() {
  markerCluster.clearMarkers();
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
}

function setMarkerIcon(marker){
    // Sets Marker Icon to [red, green, yellow, purple, green] marker
    marker.setIcon('https://maps.google.com/mapfiles/ms/icons/red-dot.png');
}

function repopulateMarkers(){
	$.getJSON(url, function(data){
		$.each(data.features, function(key, val){
			var lon = getCoords(val).lon;
			var lat = getCoords(val).lat;
	        var marker = new MarkerWithLabel({
	            map: map,
	            title: name,
	            position: new google.maps.LatLng(lat, lon),
	            labelContent: getLabelContent(val),
	            labelAnchor: new google.maps.Point(20, 0),
	            labelClass: "labels",
	        });
	        markers.push(marker);
	        setMarkerIcon(marker);
			addMarkerEventListeners(val, marker);
      	});
		markerCluster.addMarkers(markers);
	});
}

function changeDoseUnits(){
	setHTML_units();
	for (var i = 0; i < markers.length; i++) {
		var label_text = getLabelContent(json_vals[i]);
		markers[i].labelVisible = false;
		markers[i].setOptions({ labelContent: label_text });
		//markers[i].labelContent = label_text;
		markers[i].labelVisible = true;
	}
}

function getDosimeterCoords(index){
	var lat = parsed_json.features[index].geometry.coordinates[1];
	var lon = parsed_json.features[index].geometry.coordinates[0];
	var location = new google.maps.LatLng(lat, lon);
	return location
}

function getSelectedDosimeterIndex(){
	var sel = document.getElementById('dosimeter_list');
	var index = sel.selectedIndex;
	dosimeter_name = sel.options[sel.selectedIndex].value;
	return index;
}

function goToDosimeter(){
	infowindow.close();
	var index = getSelectedDosimeterIndex();
	var center = getDosimeterCoords(index);
	map.setCenter(center);
}

function initMap(){
	map = new google.maps.Map(document.getElementById('map-canvas'), {
		zoom: 9,
		disableDefaultUI: true
	});
	google.maps.event.addListener(map, 'click', function() {
		infowindow.close();
	});
}

function getCoords(val){
	return {
		lon : val.geometry.coordinates[0],
		lat : val.geometry.coordinates[1]
	}
}

function SetUnitMap(){
	unitMap.set("CPM",["CPM",1.0,1]);
	unitMap.set("mrem/hr",["mREM/hr",1.0,4]);
	unitMap.set("&microSv/hr",["&microSv/hr",1.0,3]);
	unitMap.set("air travel/hr",["&microSv/hr",0.420168067,4]);
	unitMap.set("cigarettes/hr",["&microSv/hr",0.00833333335,4]);
	unitMap.set("X-rays/hr",["&microSv/hr",0.2,4]);
}

function getLabelContent(val){
	selected_unit = getDoseUnit();
	latest_val = (val.properties[unitMap.get(selected_unit)[0]]*unitMap.get(selected_unit)[1]).toFixed(unitMap.get(selected_unit)[2]);
	return ("&nbsp" + latest_val + "&nbsp" + selected_unit + "&nbsp");
}

function addMarkerEventListeners(val, marker){
	// Adds listener to open infowindow with content from updateInfowindowContent()
	// updateInfowindowContent() will allow you to enter the graphs from the geoJSON file
	google.maps.event.addListener(marker, 'click', (function(marker) {
		return function() {
			infowindow.setContent(updateInfowindowContent(val));
			infowindow.open(map, marker);
			selected_val = val;
			selected_marker = marker;
		};
	})(marker));
}

function addTimeDropdownListener(){
	$("#time_dropdown").change(function(){
		//infowindow.close();
		goToDosimeter();
		infowindow.setContent(updateInfowindowContent(selected_val));
		infowindow.open(map, selected_marker);
	});
}

function addUnitDropdownListener(){
	$("#dose_dropdown").change(function(){
		//infowindow.close();
		goToDosimeter();
		infowindow.setContent(updateInfowindowContent(selected_val));
		infowindow.open(map, selected_marker);
	});
}

$(document).ready(function(){
	var marker;
	initMap();
	centerMap(berkeley); //Because we're self-centered.
	SetUnitMap();

	// Fetch geoJSON file - runs function on complete, 'data' is extracted from JSON
	$.getJSON(url, function(data){
		parsed_json = data;
		// For each item in "features" array inside data runs function
		// key: position of item in the array Features
		// val: value of item
		$.each(data.features, function(key, val){
			$("#dosimeter_list").append($("<option />").text(val.properties["Name"]));
			var lon = getCoords(val).lon;
			var lat = getCoords(val).lat;
	        var marker = new MarkerWithLabel({
	            map: map,
	            title: name,
	            position: new google.maps.LatLng(lat, lon),
	            labelContent: getLabelContent(val),
	            labelAnchor: new google.maps.Point(20, 0),
	            labelClass: "labels",
							animation: google.maps.Animation.DROP
	        });
			markers.push(marker);
	        json_vals.push(val);
		    setMarkerIcon(marker);
			addMarkerEventListeners(val, marker);
	    });
		for (var i = 0; i < markers.length; i++) {
		 bounds.extend(markers[i].getPosition());
		}
		map.fitBounds(bounds);
		addTimeDropdownListener();
		addUnitDropdownListener();
		var mcOptions = {gridSize: 40, maxZoom: 15};
		markerCluster = new MarkerClusterer(map, markers, mcOptions);
	});
});
