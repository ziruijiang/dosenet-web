var data_string_map = new Map();
var timeParMap = new Map();
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

//var url = 'https://radwatch.berkeley.edu/sites/default/files/dosenet/pinewood.csv?'
//+ Math.random().toString(36).replace(/[^a-z]+/g, ''); // To solve browser caching issue
function parseDate(input) {
  var parts = input.replace('-',' ').replace('-',' ').replace(':',' ').replace(':',' ').replace(',',' ').split(' ');
  // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5]); // Note: months are 0-based
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

function get_time_pars(time,end_date,start_date,nentries) {
  start_date = new Date(end_date.getTime() - timeParMap.get(time)[0]);
  nentries = Math.min(nentries,timeParMap.get(time)[1]);
  return [start_date,nentries];
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

function process_csv(text,dose,time) {
  var raw_data = [];
  var data_input = [];
  var lines = text.split("\n");
  var nentries = lines.length; // compare to full set possible for given time interval and keep smaller value
  var newest_data = lines[lines.length-2].split(",");
  var oldest_data = lines[1].split(",");
  var end_date = new Date(parseDate(newest_data[0]));
  var start_date = new Date(parseDate(oldest_data[0]));

  var time_pars = get_time_pars(time,end_date,start_date,nentries);
  start_date = time_pars[0];
  nentries = time_pars[1];

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

  var sample_size = timeParMap.get(time)[2];
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
  var data_map = new Map();
  // keep track of range of start and end times from all locations
  var start_date_range = [];
  var end_date_range = [];

  length = csv_map.size;

  csv_map.forEach( function(csv, location, csv_map ) {
    var this_data = process_csv(csv,dose,time);
    start_date_range.push(this_data[0][0]);
    end_date_range.push(this_data[this_data.length-1][0]);
    data_map.set(location,this_data);
  });

  // Set time binning based on full range of dates from all data
  var start_date = new Date(Math.max.apply(null,start_date_range));
  var end_date = new Date(Math.max.apply(null,end_date_range));
  var sample_size = timeParMap.get(time)[2];
  // default bin size: add 5 minute increments from start (5*60*1000)
  // rebin by sample_size -> bin_size = default*sample_size
  var bin_size = sample_size*5*60*1000;
  var time_bins = set_time_bins(start_date,end_date,bin_size);
  console.log([time_bins[0],time_bins[time_bins.length-1]]);

  // Now put all data into bins...
  var time_map = fill_binned_data(data_map,time_bins,bin_size);

  var data_input = fill_data_input(time_bins,time_map,get_key_array(csv_map));
  return data_input;
}

function plot_data(location,data_input,dose,timezone,data_labels,time,div) {
  var title_text = location;
  var y_text = dose;
  // add x-label to beginning of data label array
  data_labels.unshift(timezone);
  console.log(data_labels);
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
      console.log('adding data from '+url+' to '+locations[i]);
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
    var data_input = [];
    data_input = process_all_data(data_string_map,dose,time);
    plot_data("All locations",data_input,dose,"Time (local)",return_locations,time,div);
  });
}

function get_data(url,location,timezone,dose,time,div) {
  $.get(url, function (data) {
      var data_input = []; // Clear any old data out before filling!
      data_input = process_csv(data,dose,time);
      var data_label = [];
      if ( dose=="&microSv/hr" ) { data_label.push("µSv/hr"); }
      else data_label.push(dose);
      plot_data(location,data_input,dose,timezone,data_label,time,div);
  },dataType='text');
}
