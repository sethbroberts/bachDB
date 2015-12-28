
var $search = $('#searchstring');
$('#searchbutton').on('click', function(evt) {
  evt.preventDefault();
  console.log($search.val());
  vis.selectAll('.node')
    .classed('searchhighlighted', false)
    .filter(function(work) {
      return (
        $search.val().trim() !== '' && (
          work.ID.toUpperCase() === $search.val().toUpperCase() ||
          ~work.Title.toUpperCase().indexOf($search.val().toUpperCase())
        )
      );
    })
    .classed('searchhighlighted', true);
})


//set width and height of window
var width = window.innerWidth/3*2; ////
var height = window.innerHeight;

//place svg box on window, class="vis"
var vis = d3.select('.bodyright').append('svg').attr('class', 'vis')
    .style({ 
      width: width + 'px', 
      height: height + 'px' 
    });

//initialize vars
var node;
var max;

//margin seems to be left margin
//e.g, var x = d3.scale.linear().domain([0, steps_x]).range([margin, width - margin]);
var margin = 30;

//initialize max area of circle, tooltip
var max_area = 300;
var tooltip;

//below 450, margin_top resizes down
var margin_top = (width > 450) ? 120 : 20;
var margin_bottom = 50;

//steps_x is #cols, steps_y is #rows
var steps_x = 48;
var steps_y = 25;

//ordinal scale with 20 categorical colors
var color = d3.scale.category20();

//say window width=1024, steps_x=100 -> r1 = 7.3
//say window hight=400, steps_y=28 -> r2 = 10.2
//r = r1, max_area gets set to 167
var calcBestArea = function(){
  var r1 = (width / steps_x) / 1.4;
  var r2 = (height / steps_y) / 1.4;
  var r = r1 < r2 ? r1 : r2;
  return Math.PI * r * r;
};
var max_area = calcBestArea();

//make scale from 0 to max area, linear
var areaScale = d3.scale.linear().range([50, max_area]);

//maps and area to a radius
var areaToRadius = function(area){ 
  return Math.sqrt(area / Math.PI) 
};

//fisheye
var fisheye = d3.fisheye.circular().radius(30).distortion(2);

//initial colorMetric
var colorMetric = 'Genre';

//sortMetric is user's choice of what to 'sort by'
//d is a node.datum() -- an object, a row from the table, properties are attributes of this row
//called inside posTooltip function
var radius = function(d){ 
  var metric = 'Duration';
  if(metric === 'Title' || metric === 'Genre') {
    metric = 'Duration';
  }
  //scales the value d[metric] to be between [0, max_area], returns radius of this area
  return areaToRadius(areaScale(d[metric])) 
};

//maps the number of cols to the width of the display
var x = d3.scale.linear().domain([0, steps_x]).range([margin, width - margin]);

//maps the number of rows to the height of the display
var y = d3.scale.linear().domain([0, steps_y]).range([margin_top, height - margin_bottom]);

//input: a row, output: node.datum.id, the id of the row object
var dataKey = function(d){ 
  return d.id 
};

//input: a property, output: tells how to sort 2 items on this property
var sortBy = function(by){
  console.log(by);
  if(by === 'Duration') {
    return function(a, b){ 
      if(a[by] === b[by]) {
        return 0; 
      } else if(a[by] > b[by]) {
        return -1;
      }
      return 1;
    }
  } else {
    if(by === 'ID') {
      by = 'Number';
    }
    return function (a, b) {
      return a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : a[by] >= b[by] ? 0 : NaN;
    }
  }
}; 


var id = 0;
var order = 0;

//grab sort metric from DOM element selector
var sortMetric = $('.sort-by').val();

//input: data row object; reformats certain columns of data to numeric
//increments value of 'id' and 'order'
//calculates two new properties, adds those to row object
//returns updated object
var format = function(d){
  //column headers, for reference
  // ID,Number,Title,Duration,Key,Year,Forces,YouTubeID,Genre,
  var numKeys = ['Duration', 'Number'];
  numKeys.forEach(function(key){ 
    d[key] = Number(d[key]) 
  });
  d.id = id++
  d.order = order++
  return d
};

//iframe detection
var topNode = null;
if ( window.self !== window.top ){
  // we're in an iframe! oh no! hide the twitter follow button
  $('.share-left').hide()
}

//read .csv file
d3.csv('bach-db-rev-2.csv', format, function(err, rows){
  if(err) throw err
  works = rows
  gotWorks(works)
  fisheyeEffect(vis)
});

//input: new sortMetric; job: rescales the area
//max of new area is the highest value of all works on metric
function updateAreaScale(sortMetric){
  var metric = sortMetric
  areaScale.domain([0, d3.max(works, function(d){ return d[metric] })])
};

//input works; jobs: updates areaScale (max size of circles)
//makes the cirles
function gotWorks(works){
  //set max area based on sortMetric
  updateAreaScale(sortMetric)
  //attach data to nodes, set class, update color
  node = vis.selectAll('.node').data(works, dataKey)
    .enter().append('g')
      .attr('class', 'node')
      .call(updateColor);
  //append a circle to each node, radius function calcs radius based on sort metric
  node.append('circle').attr('r', radius);
  //randomize starts at random position
  node.call(randomize).call(updatePos).call(sortNodesByMetric.bind(null, sortMetric));
  //highlight on click
  node.on('click', function(element){
    $('iframe').attr('src', 'https://www.youtube.com/embed/'+ element.YouTubeID +'?rel=0')
    //console.log(element.YouTubeID)
    var node = d3.select('.node.highlighted').classed('highlighted', false).node()
    var sel = d3.select(this);
    sel.classed('searchhighlighted', false);
    if(sel.node() !== node) sel.classed('highlighted', !d3.select(this).classed('highlighted'))
  })
  vis.call(createTooltip);
};

//displays info for data circles in tooltip on highlight
function createTooltip(vis){
  tooltip = vis.append('g').attr('class', 'tooltip')
  tooltip.append('rect').attr({ width: 130, height: 140, rx: 5, ry: 5, class: 'bg' })
  var desc = tooltip.append('g').attr('class', 'desc')
  //id, title, key, genre will always appear in tool tip descriptions
  desc.append('text').attr('class', 'id').text('id: ').attr('transform', 'translate(5,15)')
  desc.append('text').attr('class', 'title').text('title: ').attr('transform', 'translate(5,35)')
  desc.append('text').attr('class', 'key').text('key: ').attr('transform', 'translate(5,55)')
  desc.append('text').attr('class', 'genre').text('genre: ').attr('transform', 'translate(5,75)')
  //.main class will hold 'variable text' of tooltip (depends on what is sorting variable)
  desc.append('text').attr('class','main').text(' ').attr('transform', 'translate(5,95)')
  return tooltip
};

//decide where to position tooltip
function posTooltip(node){
  if( node.empty() ) {
    return
  }
  var d = node.datum(); 
  var text; 
  var x = d.fisheye.x;
  var y = d.fisheye.y

  tooltip.select('.id').text('ID: ' + d.ID);
  tooltip.select('.title').text('Title: ' + d.Title);
  tooltip.select('.duration').text('Duration: ' + d.Duration);
  tooltip.select('.key').text('Key: ' + d.Key);
  tooltip.select('.forces').text('Forces: ' + d.Forces);
  tooltip.select('.genre').text('Genre: ' + d.Genre);
  tooltip.select('.year').text('Year: ' + d.Year);

  //depeding on sort metric, change the text shown in bottom part of tooltip
  if(sortMetric === 'Forces') {
    text = 'Forces: ' + d.Forces;
  } else if(sortMetric === 'Year') {
    text = 'Year: ' + d.Year;
  }
  //add the 'variable text' to tooltip
  tooltip.select('.main').text(text);

  var box = tooltip.select('.desc').node().getBBox();
  box.x -= 10;
  box.y -= 10;
  box.width += 20;
  box.height += 20;
  tooltip.select('rect').attr(box);
  var offset = radius(d) * d.fisheye.z;
  if( x > width / 2 ) {
    x -= box.width + offset; 
  } else {
    x+= offset;
  }
  if( y > height / 2 ) {
    y -= box.height + offset; 
  } else {
    y+= offset;
  }
  tooltip.attr('transform', 'translate(' + x + ',' + y + ')');
};

//move node
function updatePos(node){
  node.attr('transform', function(d){
    return 'translate(' + d.x + ',' + d.y + ')'
  })
  updateAreaScale(sortMetric)
  //node.select('circle').attr('r', radius)
  return node
};

//input: row (data circle); updates style using color function
function updateColor(node){
  node.style('fill', function(d){ return color(d[colorMetric]) })
};

//fisheye position
function setFisheyePos(node){
  node.attr('transform', function(d, i){
    return 'translate(' + d.fisheye.x + ', ' + d.fisheye.y + ')'
  })
  node.select('circle').attr('transform', function(d){
    var z = d.fisheye && d.fisheye.z || 1
    return 'scale(' + z + ')'
  })
  return node
};

//random position for node
function randomize(node){
  node.each(function(d){
    d.x = Math.random() * width
    d.y = Math.random() * height
  })
};

//positioning nodes
function grid(node){
  return node.data().forEach(function(d){
    d.x = x(d.order % x.domain()[1])
    d.y = y(Math.floor(d.order / x.domain()[1]))
  })
};

//sorting nodes by metric (numeric)
function sortNodesByMetric(metric, node){
  //around line 84 is sortBy function
  var data = node.data().sort(sortBy(metric))
  data.forEach(function(d, i){ d.order = i })
  node.data(data, dataKey)
  return node.call(grid).transition().duration(2000).call(updatePos)
};


// listen for change on sort by selector
$('.sort-by').on('change', function(){
  var newMetric = $(this).val()
  if(sortMetric === newMetric) return
  sortMetric = newMetric
  sortNodesByMetric(sortMetric, node)
});

// listen for change on color by selector
$('.color').on('change', function(){
  var newMetric = $(this).val()
  console.log("newMetric", newMetric)
  if(newMetric === colorMetric) return
  colorMetric = newMetric
  node.transition().duration(2000).call(updateColor)
});

// stuff to resize window
$(window).resize(function(){
  width = window.innerWidth/3*2 ////
  height = window.innerHeight
  if(width < 450) margin_top = 20
  else margin_top = 120
  vis.style({ width: width + 'px', height: height + 'px' })
  x.range([margin, width - margin])
  y.range([margin_top, height - margin_bottom])
  node.call(grid).call(updatePos)
  updateMaxArea()
  node.select('circle').attr('r', radius)
});

// fish eye effect
function fisheyeEffect(vis){
  return vis.on('mouseover', function(d){
    if(!node) return
    d3.select('.tooltip').style('display', 'inherit')
    //node.each(function(d, i){  $(this).removeClass('animated') })
  }).on("mousemove", function(d){
    var m = d3.mouse(this)
    fisheye.focus(m)
    if(!node) return
    node.each(function(d, i){
      var prev_z = d.fisheye && d.fisheye.z || 1
      d.fisheye = fisheye(d)
      d.fisheye.prev_z = prev_z
    })
    .filter(function(d){ return d.fisheye.z !== d.fisheye.prev_z })
    .sort(function(a, b){ return a.fisheye.z > b.fisheye.z ? 1 : -1 })
    .call(setFisheyePos)
    .call(function(node){
      var max, maxNode
      node.each(function(d){
        if( !max || d.fisheye.z > max.fisheye.z) { max = d; maxNode = this }
      })
      if(topNode !== maxNode) updateTopNode(maxNode)
    })
  }).on('mouseleave', function(d){
    d3.select('.tooltip').style('display', 'none')
    node.each(function(d, i){ d.fisheye = {x: d.x, y: d.y, z: 1} })
    .filter(function(d){ return d.fisheye.z !== d.fisheye.prev_z })
    .call(setFisheyePos)
  })
};

function updateMaxArea(){
  max_area = calcBestArea()
  areaScale.range([50, max_area])
};

function updateTopNode(maxNode){
  if(topNode) topNode.classed('active', false)
  topNode = d3.select(maxNode).classed('active', true)
  topNode.call(posTooltip)
};

