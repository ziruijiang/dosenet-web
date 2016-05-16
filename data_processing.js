var nentries = 0;
var sample_size = 1;
var start_date = new Date();
var end_date = new Date();
var data_string_map = new Map();
var timeParMap = new Map();
var colors = [];
var data_map = new Map();
var bin_size;
var time_bins = [];

// timeParMap structure: key = selected time range, value = [absolute time range,max nentries,data compression factor]
timeParMap.set('Hour',[3600*1000,13,1]);
timeParMap.set('Day',[24*3600*1000,289,6]);
timeParMap.set('Week',[7*24*3600*1000,2017,12]);
timeParMap.set('Month',[30*24*3600*1000,8641,48]);
timeParMap.set('Year',[365*24*3600*1000,105121,288]);
timeParMap.set('All',[365*24*3600*10000,1000000,1]);

var calibMap = new Map();
// calibMap structure: key = unit, value = calibration
calibMap.set('CPM',1.0);
calibMap.set('mrem/hr',0.0036);
calibMap.set('&microSv/hr',0.036);
calibMap.set('air travel/hr',0.420168067*0.036);
calibMap.set('cigarettes/hr',0.00833333335*0.036);
calibMap.set('X-rays/hr',0.2*0.036);


function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// Set sample size based on number of entries available rather than time window
function getSampleSize(nentries) {
  // sample such that there are roughly 150 entries max
  var sample = Math.floor(nentries/150);
  if( sample === 0 ) sample = 1;
  return sample;
}

//var url = 'https://radwatch.berkeley.edu/sites/default/files/dosenet/pinewood.csv?'
//+ Math.random().toString(36).replace(/[^a-z]+/g, ''); // To solve browser caching issue
function parseDate(input) {
  var parts = input.replace('-',' ').replace('-',' ').replace(':',' ').replace(':',' ').replace(',',' ').split(' ');
  // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5]); // Note: months are 0-based
}

/**
 * Convert hsv values to an rgb(r,g,b) string. Taken from MochiKit.Color. This
 * is used to generate default series colors which are evenly spaced on the
 * color wheel.
 * @param { number } hue Range is 0.0-1.0.
 * @param { number } saturation Range is 0.0-1.0.
 * @param { number } value Range is 0.0-1.0.
 * @return { string } "rgb(r,g,b)" where r, g and b range from 0-255.
 * @private
 */
function hsvToRGB(hue, saturation, value) {
  var red;
  var green;
  var blue;
  if (saturation === 0) {
    red = value;
    green = value;
    blue = value;
  } else {
    var i = Math.floor(hue * 6);
    var f = (hue * 6) - i;
    var p = value * (1 - saturation);
    var q = value * (1 - (saturation * f));
    var t = value * (1 - (saturation * (1 - f)));
    switch (i) {
      case 1: red = q; green = value; blue = p; break;
      case 2: red = p; green = value; blue = t; break;
      case 3: red = p; green = q; blue = value; break;
      case 4: red = t; green = p; blue = value; break;
      case 5: red = value; green = p; blue = q; break;
      case 6: // fall through
      case 0: red = value; green = t; blue = p; break;
    }
  }
  red = Math.floor(255 * red + 0.5);
  green = Math.floor(255 * green + 0.5);
  blue = Math.floor(255 * blue + 0.5);
  hex = rgbToHex(red,green,blue);
  return hex;
}

var colorMap = new Map();

function setColors(locations){
  ncolors = locations.length;
  console.log('First time setting colors for '+ncolors+' stations');
  var sat = 1.0;
  var val = 0.5;
  var half = Math.ceil(ncolors / 2);
  for (var i = 0; i < ncolors; i++) {
    var idx = i % 2 ? (half + (i + 1)/ 2) : Math.ceil((i + 1) / 2);
    var hue = (1.0 * idx / (1 + ncolors));
    colorStr = hsvToRGB(hue, sat, val);
    colors.push(colorStr);
    colorMap.set(locations[i],colorStr);
  }
}

function getColors(locations){
  if( colors.length===0 ) setColors(locations);
  return colorMap;
}

function resetColors(){
  colors = [];
  colorMap.forEach( function(color, this_location, colorMap) {
    colors.push(color);
  });
}

function singleErrorPlotter(e) {
  var ctx = e.drawingContext;
  var points = e.points;
  var g = e.dygraph;
  var color = e.color;
  ctx.save();
  ctx.strokeStyle = e.color;

  for (var i = 0; i < points.length; i++) {
    var p = points[i];
    var center_x = p.canvasx;
    if (isNaN(p.y_bottom)) continue;

    var low_y = g.toDomYCoord(p.yval_minus),
        high_y = g.toDomYCoord(p.yval_plus);

    ctx.beginPath();
    ctx.moveTo(center_x, low_y);
    ctx.lineTo(center_x, high_y);
    ctx.stroke();
  }

  ctx.restore();
}

function get_time_pars(time,newest_date,ndata) {
  var oldest_date = new Date(newest_date.getTime() - timeParMap.get(time)[0]);
  var nbins = Math.min(ndata,timeParMap.get(time)[1]);
  return [oldest_date,nbins];
}

function set_time_bins(start_date,end_date,bin_size){
  var time_array = [];
  // fill array with bin center with start date as low edge of first bin
  var this_date = new Date(start_date.getTime() + bin_size/2);
  while( this_date.getTime() < end_date.getTime() ) {
    time_array.push(this_date);
    // high edge of bin becomes new low edge
    this_date = new Date(this_date.getTime() + bin_size);
  }
  return time_array;
}

function findNearestDate(alist, date, delta) {
  var first = 0;
  var last = alist.length-1;
  var found = false;
  var index = -1;

  while( first<=last && !found ) {
    var midpoint = Math.floor((first + last)/2);
    if( Math.abs(alist[midpoint].getTime()-date.getTime()) < delta ) {
      index = midpoint;
      found = true;
    }
    else {
      if( date.getTime() < alist[midpoint].getTime() )
        last = midpoint-1;
      else
        first = midpoint+1;
    }
  }

  return index;
}

function getTimeRange(text,time) {
  var lines = text.split("\n");
  var newest_data = lines[lines.length-2].split(",");
  var oldest_data = lines[1].split(",");
  var newest_date = new Date(parseDate(newest_data[0]));
  var oldest_date = new Date(parseDate(oldest_data[0]));

  var time_pars = get_time_pars(time,newest_date,oldest_date,lines.length);
  oldest_date = time_pars[0];

  // Get data for maximum number of entries from all data inputs
  nentries = Math.max(nentries,time_pars[1]);
  // Reset sample_size based on new maximum number of data points
  sample_size = getSampleSize(nentries);
  if( time== "All" ) sample_size = 1;
  // Go back as far as we can based on current range of available data
  if( oldest_date < start_date ) start_date = oldest_date;
  // Go to the most current date for all input data
  if( newest_date > end_date ) end_date = newest_date;
}

function process_csv(text,dose,time) {
  var raw_data = [];
  var data_input = [];
  var lines = text.split("\n");

  for( var i = lines.length - nentries; i < lines.length; ++i ) {
    if( i < 1 ) { continue; } // skip first line(s) with meta-data
    var line = lines[i];
    if(line.length>3) {
      var data = line.split(",");
      var x = new Date(parseDate(data[0]));
      if( x.getTime() < start_date.getTime() ) { continue; }
      var y = parseFloat(data[1]);
      raw_data.push([x,y]);
    }
  }

  var scale = calibMap.get(dose);
  data_input = average_data(raw_data,sample_size,scale);
  return data_input;
}

function average_data(raw_data,sample_size,scale)
{
  var averaged_data = [];
  var npoints = Math.floor(raw_data.length/sample_size);
  for(n=0; n < npoints; n++){
    sub_data = raw_data.slice(n*sample_size,(n+1)*sample_size);
    var average = 0;
    for(i=0;i<sub_data.length;i++)
    {
      var this_data = sub_data[i];
      average += this_data[1]*5; // total counts was already averaged over 5 minute interval
    }
    error = Math.sqrt(average)/sub_data.length/5;
    average = average/sub_data.length/5;
    var d = Math.floor(sub_data.length/2);
    var mid_data = sub_data[d];
    var date = mid_data[0];
    averaged_data.push([date,[average*scale,error*scale]]);
  }
  return averaged_data;
}

// Maps each time bin to list of stations with [cpm,error] for that bin
function fill_binned_data(data_map,time_bins,bin_size) {
  var time_map = new Map();
  data_map.forEach( function(data, location, data_map ) {
    // If location not checked don't include in time_map
    if( !document.getElementById(location).checked ) return;
    for( var i=0; i<data.length; i++) {
      // date for each entry in data array for each location is the first element for that entry
      var this_date = data[i][0];
      // time bins is list of bin centers
      // each date should then be either half a bin before or after the bin center
      var this_bin = findNearestDate(time_bins,this_date,bin_size/2);
      if( this_bin < 0 ) {
        //console.log('WARNING: no valid time bin for data at '+this_date);
        continue;
      }
      var this_data = data[i][1]; // this is [cmp,error]
      // map data to given location for next step (need to know which locations went in to each bin)
      var this_data_map = new Map();
      this_data_map.set(location,this_data);
      if( time_map.has(this_bin) ) {
        time_map.get(this_bin).push(this_data_map);
      }
      else {
        var this_data_map_array = [];
        this_data_map_array.push(this_data_map);
        time_map.set(this_bin,this_data_map_array);
      }
    }
  });
  return time_map;
}

function fill_data_input(time_bins,time_map,locations) {
  var data_input = [];
  for ( var bin=0; bin<time_bins.length; bin++ ) {
    //There might not be data for every time bin...
    if( !time_map.has(bin) ) {
      console.log("WARNING: no data for this time bin!");
      continue;
    }

    var data_array = [];
    data_array.push(time_bins[bin]);
    for( var j=0; j<locations.length; j++ ) {
      var has_location = false;
      for( var i=0; i<time_map.get(bin).length; i++ ) {
        // if this entry for this time bin has data for this location add it to the data array for this time bin
        if( time_map.get(bin)[i].has(locations[j]) ) {
          data_array.push(time_map.get(bin)[i].get(locations[j]));
          has_location = true;
        }
      }
      if( !has_location )
        data_array.push(null); // if no data for this location give it a null entry
    }
    data_input.push(data_array);
  }
  return data_input;
}

function process_all_data(csv_map,dose,time) {
  // fill map with key = location, value = [time,[cpm,error]] array from csv file  
  // Full map of all data for all locations
  // Set time binning based on full range of dates from all data
  csv_map.forEach( function(csv, location, csv_map ) {
    getTimeRange(csv,time);
  });
  // default bin size: add 5 minute increments from start (5*60*1000)
  // rebin by sample_size -> bin_size = default*sample_size
  bin_size = sample_size*5*60*1000;
  time_bins = set_time_bins(start_date,end_date,bin_size);
  //console.log([time_bins[0],time_bins[time_bins.length-1]]);
  //console.log('number of data entries = '+time_bins.length*sample_size);
  nentries = time_bins.length*sample_size;

  // Now get and average all data based on full time range available for all locations
  data_map.clear();
  csv_map.forEach( function(csv, location, csv_map ) {
    var this_data = process_csv(csv,dose,time);
    data_map.set(location,this_data);
  });

  // Now put all data into bins...
  var time_map = fill_binned_data(data_map,time_bins,bin_size);
  var data_input = fill_data_input(time_bins,time_map,get_key_array(csv_map));
  return data_input;
}

function resetData(){
  colors = [];
  console.log(colorMap);
  colorMap.forEach( function(color, location, colorMap) {
    if( !document.getElementById(location).checked ) return;
    colors.push(color);
  });
  var time_map = fill_binned_data(data_map,time_bins,bin_size);
  console.log(time_map);
  var data_input = fill_data_input(time_bins,time_map,get_key_array(colorMap));
  g.updateOptions({
    'file': data_input,
  });
}

function plot_data(location,data_input,dose,timezone,data_labels,time,div) {
  var title_text = location;
  var y_text = dose;
  // add x-label to beginning of data label array
  time_label = 'Time ('+timezone+')';
  data_labels.unshift(time_label);
  if( time=="All" ) { title_text = 'All data for ' + title_text; }

  g = new Dygraph(
    // containing div
    document.getElementById(div),
    data_input,
    { title: title_text,
      errorBars: true,
      connectSeparatedPoints: false,
      drawPoints: true,
      pointSize: 3,
      showRangeSelector: true,
      sigFigs: 3,
      ylabel: y_text,
      xlabel: data_labels[0],
      labels: data_labels,
      strokeWidth: 0.0,
      highlightCircleSize: 5,
      plotter: [
        singleErrorPlotter,
        Dygraph.Plotters.linePlotter
        ],
      axes: {
      	y: {
      		    //reserveSpaceLeft: 2,
          		axisLabelFormatter: function(x) {
        	  		                          			var shift = Math.pow(10, 5);
      		      		                          	return Math.round(x * shift) / shift;
        		      		                        }
      	   },
      }
    }
  );
}

function add_data_string(data,location) {
  data_string_map.set(location,data);
}

function process_urls(url_array,locations) {
  var csv_get_done = [];
  $.each(url_array,function(i,url) {
    csv_get_done.push($.get(url, function(data) {
      add_data_string(data,locations[i]);
      //console.log('adding data from '+url+' to '+locations[i]);
    }, dataType='text'));
  });
  return csv_get_done;
}

function get_key_array(map) {
  var key_array = [];
  map.forEach( function(value, key, map) {
    key_array.push(key);
  });
  return key_array;
}

function get_all_data(url_array,locations,dose,time,div) {
  data_string_map.clear();
  csv_get_done = process_urls(url_array,locations);
  $.when.apply($, csv_get_done).then( function() {
    var return_locations = get_key_array(data_string_map);
    getColors(return_locations);
    colorMap.forEach( function(color, location, colorMap ) {
      //console.log('setting color for '+location+' to '+color);
      document.getElementById(location+'_div').style.color = color;
      document.getElementById(location).checked = true;
    });
    var data_input = [];
    data_input = process_all_data(data_string_map,dose,time);
    plot_data("All locations",data_input,dose,"America/Los_Angeles",return_locations,time,div);
    g.updateOptions({
      colors: colors,
    });
  });
}

function shift_time(data_input,diff) {
  for( var i=0; i<data_input.length; i++ ) {
    data_input[i][0] = new Date(data_input[i][0].getTime() + diff*60000);
  }
}

function get_data(url,location,timezone,dose,time,div) {
  $.get(url, function (data) {
      var data_input = []; // Clear any old data out before filling!
      getTimeRange(data,time);
      data_input = process_csv(data,dose,time);
      // shift date by 12hrs (argument to function is minutes)
      if( timezone=="Asia/Tokyo" ) shift_time(data_input,16*60);
      var data_label = [];
      if ( dose=="&microSv/hr" ) { data_label.push("µSv/hr"); }
      else data_label.push(dose);
      plot_data(location,data_input,dose,timezone,data_label,time,div);
  },dataType='text');
}
