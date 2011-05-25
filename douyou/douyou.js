var DEFAULT_ICON = "images/dou.jpg";
var DOUBAN_API_PEOPLE = "http://api.douban.com/people/";
var DOUBAN_PEOPLE = "http://www.douban.com/people/";
var DOUBAN_API_KEY = "0a2a857383c88c2e1e7f905a8b59a48a";
var uid = "liongg";
var numMax = 0;
var numFetch = 0;
var provinceDetails = {}; //{北京:5,黑龙江:3,...}
var cityDetails = {};  //{江苏南京:4,黑龙江大庆:1,...}    
var iconDetails = {};  //{江苏南京:头像链接集合,黑龙江大庆:头像链接集合,...}

var map = null;
var markerArray = [];
var geocoder = new google.maps.Geocoder();
var infowindow = new google.maps.InfoWindow({ maxWidth: 270 });
var MAP_PIN_CHART_URL = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=#{0}|#{1}|#{2}";

init();
function init() {
    var idInput = $("#idInput")
    idInput
        .bind("focus", function (e) {
            idInput.attr("border", "1px solid #14568A").attr("value", "");
        })
        .bind("blur", function (e) {
            idInput.attr("border", "1px solid #CCCCCC");
        })
        .bind("keydown", function (e) {
            (e.keyCode === 13) && startDouYou();
        });

    $('#btnOK')
        .bind("click", function (e) {
            startDouYou();
        });

    function startDouYou(){
        idInput.attr("border", "1px solid #CCCCCC");
        fetchUserInfo($.trim(idInput.attr("value")));
    }

    loadMap(document.getElementById("mapDiv"));
}

//从豆瓣获取数据并处理
function fetchUserInfo(userid) {
    clearLastData();
    uid = userid;
    var url = DOUBAN_API_PEOPLE + uid + "/contacts?start-index=1&max-results=2"
        + "&alt=xd&callback=?" + "&apikey=" + DOUBAN_API_KEY;
    uid && $.getJSON(url, function (userInfo) {
        fetchFriends(userInfo);
    });
}

function fetchFriends(userInfo) {
    numMax = userInfo['openSearch:totalResults']['$t'];
    var i = 0, url = "";
    for (; i < Math.ceil(numMax / 50); i++) {
        url = DOUBAN_API_PEOPLE + uid + "/contacts?start-index=" + (i * 50 + 1) + "&max-results=50"
            + "&alt=xd&callback=?" + "&apikey=" + DOUBAN_API_KEY;
        $.getJSON(url, function (friends) {
            processFriends(friends);
        });
    }
}

function processFriends(friends) {
    $.each(friends.entry, function (i, item) {
        processLocation(item);
    });
    numFetch += friends.entry.length;
    (numFetch == numMax) && visualizeYourFriends(); //最后一批数据    
}

function visualizeYourFriends() {
    initChartAPI();
    drawInfo(provinceDetails, numMax);
    mapIt(cityDetails, iconDetails);
}

$.extend({
    keys: function (obj) {
        var a = [];
        $.each(obj, function (k) { a.push(k) });
        return a;
    },
    filterFormat: function (source, opts) {
        var data = Array.prototype.slice.call(arguments,1), toString = Object.prototype.toString;
        if(data.length){
	        data = data.length == 1 ? 
	    	    /* ie 下 Object.prototype.toString.call(null) == '[object Object]' */
	    	    (opts !== null && (/\[object Array\]|\[object Object\]/.test(toString.call(opts))) ? opts : data) 
	    	    : data;
    	    return source.replace(/#\{(.+?)\}/g, function (match, key){
		        var filters, replacer, i, len, func;
		        if(!data) return '';
	    	    filters = key.split("|");
	    	    replacer = data[filters[0]];
	    	    // chrome 下 typeof /a/ == 'function'
	    	    if('[object Function]' == toString.call(replacer)){
	    		    replacer = replacer(filters[0]/*key*/);
	    	    }
	    	    for(i=1,len = filters.length; i< len; ++i){
	    		    func = baidu.string.filterFormat[filters[i]];
	    		    if('[object Function]' == toString.call(func)){
	    			    replacer = func(replacer);
	    		    }
	    	    }
	    	    return ( ('undefined' == typeof replacer || replacer === null)? '' : replacer);
    	    });
        }
        return source;
    }

})

function processLocation(user) {
    if (user['db:location']) {
        //资料里有location
        var nickname = user['db:uid']['$t'];
        user['title']['$t'] && (nickname = user['title']['$t']); //昵称
        var iconUrl = DEFAULT_ICON;
        (user['link'].length > 2 && (user['link'][2]['@rel'] === 'icon')) && (iconUrl = user['link'][2]['@href']); //头像

        var location = user['db:location']['$t']; //详细地址，为了地图  
        var ulink = "<a href='" + DOUBAN_PEOPLE + user['db:uid']['$t']
					    + "' target='_blank'><img src='" + iconUrl + "' title='" + nickname + "' /></a>";
        if ($.inArray(location, $.keys(cityDetails)) !== -1) {
            cityDetails[location]++;
            iconDetails[location] += ulink;
        } else {
            cityDetails[location] = 1;
            iconDetails[location] = ulink;
        }
        //若已存在，数量加1；否则新增。

        var pro = ""; //海外 内蒙古 黑龙江...
        if (isHaiWai(location)) {
            pro = '海外';
        } else {
            isHLJorNMG(location) ? pro = location.substring(0, 3) : pro = location.substring(0, 2);
        }

        ($.inArray(pro, $.keys(provinceDetails)) !== -1) ? provinceDetails[pro]++ : provinceDetails[pro] = 1;
        //若已存在，数量加1；否则新增。
    }
}

function clearLastData() {
    numMax = 0;
    numFetch = 0;
    provinceDetails = {};
    cityDetails = {};
    iconDetails = {};
}

function isHaiWai(location) {
    var pattern = /^[a-zA-Z]/;
    return pattern.test(location);
}

function isHLJorNMG(location) {
    var str = location.substring(0, 3);
    return (str === '黑龙江' || str === '内蒙古');
}

//文字统计
function drawInfo() {
    var str = [], sum = 0, length = 0;
    $.each(provinceDetails, function (key, value) {
        str.push(key + "<span style=\"color:#389948; font-weight:bold\">" + value + "</span>");
        sum += value;
        length++;
    });
    var content = "您关注了<span style=\"color:#389948; font-weight:bold\">"
                + numMax + "</span>位豆友，有<span style=\"color:#389948; font-weight:bold\">"
                + sum + "</span>位遍布全宇宙<span style=\"color:#389948; font-weight:bold\">"
                + length + "</span>个地方，还有<span style=\"color:#389948; font-weight:bold\">"
                + (numMax - sum) + "</span>位四处飘零，求包养。<br /><br />"
	            + str.join("，") + "。";
    //$('#infoDiv').attr("innerHTML", content);
    document.getElementById("infoDiv").innerHTML = content;
}

//地图显示
function loadMap(mapElement) {
    var latlng = new google.maps.LatLng(36.871118, 103.950511);
    var myOptions = {
        zoom: 4,
        center: latlng,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    map = new google.maps.Map(mapElement, myOptions);
}

function mapIt() {
    deleteOverlays();
    var handlers = [];
    $.each(cityDetails, function (key, value) {
        handlers.push(
            function (num, city) {
                return function () {
                    geoCoderLocation(city, num);
                }
            } (value, key)
        );
    });
    delay(600, handlers); //一分钟100次
}

function geoCoderLocation(city, num) {
    geocoder.geocode({ 'address': city }, function (results, status) {
        var point = new google.maps.LatLng(23.5, 125.5);
        if (status == google.maps.GeocoderStatus.OK) {
            point = results[0].geometry.location;
            //console.log("--------" + key);
        } else {
            //console.log("位置解析失败: " + key + "  " + status);
        }
        addMarker(point, city, num);
    });
}

function addMarker(point, city, num) {
    var strList = [];
    num = num > 100 ? 99 : num;
    strList.push(num);
    strList.push(numToRGB(num));
    strList.push("000000");
    var imgUrl = $.filterFormat(MAP_PIN_CHART_URL, strList);
    var marker = new google.maps.Marker({
        position: point,
        map: map,
        title: city,
        icon: imgUrl,
        animation: google.maps.Animation.DROP
    });
    markerArray.push(marker);

    var contentString = "在<strong>" + city + "</strong>捡到<strong>" + num + "</strong>粒豆子:<br />"
			+ "<div>" + iconDetails[city] + "</div>";
    google.maps.event.addListener(marker, 'click', function (m) {
        return function () {
            infowindow.setContent(contentString);
            infowindow.open(map, m);
        }
    } (marker));
}

function deleteOverlays() {
    if (markerArray) {
        $.each(markerArray, function (i, item) {
            item.setMap(null);
        });
        markerArray.length = 0;
    }
}

function numToRGB(num) {
    if (num < 4) return "00FF00";
    if (num < 7) return "00FFFF";
    if (num < 10) return "FF0000";
    if (num < 20) return "FFFF00";
    if (num < 40) return "990099";
    return "3399AA";
}

function delay(interval, handlers) {
    if (handlers) {
        var i = 0;
        setTimeout(function () {
            if (i < handlers.length) {
                handlers[i]();
                i++;
                setTimeout(arguments.callee, interval);
            }
        }, interval);
    }
}

//饼图统计
function initChartAPI() {
    var script = document.createElement("script");
    script.src = "https://www.google.com/jsapi?key=ABQIAAAAKwx30XQe0xR70HffJOoPORS3ulPUy0LdEpEQBWZjPvNhTDp9jhSAQTB8cN6NHeyA2R_aoIZUb8gTuQ&callback=loadChartAPI";
    script.type = "text/javascript";
    document.getElementsByTagName("head")[0].appendChild(script);
}

function loadChartAPI() {
    google.load("visualization", "1", { packages: ["corechart"], "callback": drawChart });
}

function drawChart() {
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Province');
    data.addColumn('number', 'Perons per Province');

    var length = 0; //地区总数，按数量分组
    var length1 = 0; // 1个的地域有几个？
    var length2 = 0; //2个的呢？
    var length3 = 0; //3个的

    $.each(provinceDetails, function (key, value) {
        if (value == 1) length1++;
        if (value == 2) length2++;
        if (value == 3) length3++;
        length++;
    });

    //地区大于9的话，把人数少的合并起来
    var MAX_PIE = 8;
    if (length < MAX_PIE) {
        $.each(provinceDetails, function (key, value) {
            data.addRow([key, value]);
        });
    } else {
        var length12 = length - length1 - length2 + 2;
        var flag = (length12 > MAX_PIE) ? 3 : 2;
        $.each(provinceDetails, function (key, value) {
            if (value > flag) {
                data.addRow([key, value]);
            }
        });
        if (flag === 3 && length3) {
            data.addRow(["3*" + length3, 3 * length3]);
        } //合并一二后，还大于MAX_PIE，把3的也合并了
        if (length2) {
            data.addRow(["2*" + length2, 2 * length2]);
        }
        if (length1) {
            data.addRow(["1*" + length1, 1 * length1]);
        }
    }
    $('#chartDiv').attr('display', 'block');
    var chart = new google.visualization.PieChart(document.getElementById("chartDiv"));
    chart.draw(data, { width: 210, height: 200, title: '地域分布' });
}





