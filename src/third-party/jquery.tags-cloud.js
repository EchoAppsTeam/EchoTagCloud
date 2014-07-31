/**
 * @name jquery.tags-cloud.js
 * @author Sandi http://codecanyon.net/user/Sandi
 * @version v1.0
 * @date 2013
 * @category jQuery plugin
**/




;(function($, jQuery) {
	
	
	function tagsCloudEffect($thisObj, params) {
				
		var effect=this;
		
		var settings = jQuery.extend({},{
			
			//DEFAULT SETTINGS
			
			width				: $thisObj.width(), 	//width is taken from width of the element
            height				: $thisObj.height(), 	//height is taken from height of the element
            
			hwratio				: 1,		//height to width ratio
			enable				: true,
			draggable			: true,
			gravitydriven		: false,
			template			: 1,		//number of template
			maxspeed			: 4,		//maximum rotation speed
			attenuation			: 0.01,		//attenuation
			perspective			: 0.4,		//perspective koefficient
			sensitivityx		: 0.05,		//if sensitivity=0 no effect will be applied
			sensitivityy		: 0.05,		//negative values invert mouse			
			fadein				: 800,		//fadein on start (in ms)
			fog					: 0.5,		//fog index
			zsort				: true,		//sort by z
			fps					: 60,		//default fps limit
			fpsmobile			: 30,		//default fps limit on mobile devices
			scale				: 1,		//scale template
			imgscale			: 0,	//scale images (works only if they are direct children of cloud)
			onclick             : function(){}	
		} ,params);
					
		
		//variables
		var vx=0;
		var vy=0;
	
		
		
		//engine's internal parameters
		var cosVx, cosVy, sinVy, sinVx;
		var templateV, templateH;
		var gamma=0, beta=0;
		var sensitivityk;
		var renderIndex=0;
		
		var layers;				
		var number_of_layers;
		var layers_settings;
				
		//mouse related vars
		var timerId=-1;
		var timeoutID=-1;
		var dropTimer;
		var resizeTimer;
		var pressed=false;
		var dropped=false;		
		var rolledout=false;		
		var xy={};
		var touch = null;		
		var touchStart = 0;		
		
		var frameRate;
		
		if (typeof Date.now == "undefined") {
			Date.now = function(){return new Date().getTime();};
		}
		
		var lastActionTime = Date.now();
		
		
		/* ------ INIT FUNCTIONS ------ */
		
		//init tagsCloud
		var init = function () {						
			//disable text selection			
			$thisObj.attr('unselectable', 'on')
               .css({'-moz-user-select':'none',
                    '-o-user-select':'none',
                    '-khtml-user-select':'none',
                    '-webkit-user-select':'none',
                    '-ms-user-select':'none',
                    'user-select':'none'})
               .each(function() {
                    $(this).attr('unselectable','on')
                    .bind('selectstart',function(){ return false; });
                   // .bind('selectstart',function(){ return false; });
               });
			
			//disable images drag
			$thisObj.find('img').bind('dragstart', function(event) { event.preventDefault(); });
			
			//in case user provided not correct values
			checkSettings();
			
		
			//init variables						
			layers = $thisObj.children('');
			number_of_layers=layers.length;
			layers_settings=new Array();
			touch = ( 'ontouchstart' in document.documentElement ) ? true : false;
			
			sensitivityk=touch?(30/settings['fpsmobile']):(60/settings['fps']);					
			frameRate = Math.round(1000 / (touch?settings['fpsmobile']:settings['fps']));
			
			//update style
			$thisObj.css('position', 'relative').css('padding', '0px');
			layers.css('position', 'absolute');
			
			
			parseLayersSettings();	//get settings of each layer				
			saveSize();				//for correct positioning	
			accountForImages();		//for correct positioning	
			applyTemplate();		//apply template coordinates
						
			if(settings['fadein']>1){			
				$thisObj.hide().fadeIn(settings['fadein']);
			}
			
			
			$(window).resize(function(){
				onresize();
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(onresize, 100);
			});
			
			onresize();
			
			initControls();			//init mouse controls
			layers.bind('click', tagClicked);
		
		}
		
		
		
		var onresize = function(){			
			settings['width']=$thisObj.width();
			settings['height']=settings['width']*settings['hwratio'];//$thisObj.height();
			$thisObj.height(settings['height']);
			startTimer();
			
		};
		
		
		//TO DO: optimize
		if(typeof $thisObj[0].style.opacity=='undefined'){
			var applyOpacity = function(i,opacity){				
				$(layers[i]).css({opacity: opacity});	//slow for IE							
			}
		}else{			
			var applyOpacity = function(i,opacity){
				layers[i].style.opacity=opacity; 
			}
		}
		
		
		var tagClicked = function(event){
			
			//prevent touchstart
			if (touch && touchStart>1000){
				event.stopPropagation();
				event.preventDefault();
				return;
			}
			
			//cant click not visible tag
			if(settings['fog']>0){
				if($(this).css('opacity')<0.05){
					event.stopPropagation();
					event.preventDefault();
					return;
				}
			}
			
			//stop rotation if any
			vx=0;
			vy=0;
			
			//make it not available for half a second
			lastActionTime = Date.now()+500;
			
			if(typeof settings['onclick'] == 'function'){				
				var userValue=$(this).data("onclick");				
				//if(typeof userValue!='undefined') 								
				settings['onclick'](userValue);				
			}
		};
		
		
		// get and store settings of each layer
		var applyTemplate = function (){
			var xyz, maxl=0;
			
			templateV = 1;
			templateH = 1;
			var1=0;
			var2=0;
			
			if(settings['template']==0){
				parseLayersSettings();
				for (var i=0; i<number_of_layers; i++){
					maxl=Math.max(maxl,layers_settings[i].x*layers_settings[i].x+layers_settings[i].y*layers_settings[i].y+layers_settings[i].z*layers_settings[i].z);
				}
			}else{
				for (var i=0; i<number_of_layers; i++){
					//if(typeof layers_settings[i]=='undefined') layers_settings[i]={};
					if(typeof settings['template'] == 'function'){				
						xyz=settings['template'](i, number_of_layers);	
						if(typeof xyz.h!='undefined') templateH= xyz.h;
						if(typeof xyz.v!='undefined') templateV= xyz.v;
					}else{
						xyz=createXYZ(i, number_of_layers);
					}
					
					maxl=Math.max(maxl,xyz.x*xyz.x+xyz.y*xyz.y+xyz.z*xyz.z);
					layers_settings[i].x=xyz.x*(1-0.2*templateH);
					layers_settings[i].y=xyz.y*(1-0.2*templateV);
					layers_settings[i].z=xyz.z*0.8;
					
				}
			}
			
			//normalize & scale coordinates if necessary
			if(maxl>1 || settings['scale']!=1){
				maxl=(maxl>1)?(settings['scale']/Math.sqrt(maxl)):settings['scale'];
				for (var i=0; i<number_of_layers; i++){
					layers_settings[i].x*=maxl;
					layers_settings[i].y*=maxl;
					layers_settings[i].z*=maxl;
				}
			}
			
			
			setZindex();
			startTimer();	//arrange tags on the screen
		}
		
		
		var saveSize = function(){
			var l;
			for (var i=0; i<number_of_layers; i++){
				l=$(layers[i]);
				layers_settings[i].w=l.width()/2;
				layers_settings[i].h=l.height()/2;				
			}
		};
		
		
		var setZindex = function(){
			for (var i=0; i<number_of_layers; i++){
				$(layers[i]).css('z-index', i).data('ztemp',i);
				//layers_settings[i].ztemp=i;
				layers_settings[i].o=1;				
			}
		};
		
		
		// get and store settings of each layer
		var parseLayersSettings = function (){			
			var p, rnd;
			
			for (var i=0; i<number_of_layers; i++){				
				layers_settings[i]={};							
				
				rnd = sphere(i, number_of_layers, false);
				
				//x-coordinate
				p = parseFloat(jQuery(layers[i]).data("x"));
				layers_settings[i]['x']=isNaN(p)?rnd.x:p/100;
				
				//y-coordinate
				p = parseFloat(jQuery(layers[i]).data("y"));
				layers_settings[i]['y']=isNaN(p)?rnd.y:p/100;
				
				//z-coordinate
				p = parseFloat(jQuery(layers[i]).data("z"));
				layers_settings[i]['z']=isNaN(p)?rnd.z:p/100;
				
				//foolprove for lock property
				var lock = jQuery(layers[i]).data("lock");
				if(lock!=undefined){
					if(typeof lock == 'string') lock=lock.replace(/^\s+|\s+$/g, "").toLowerCase();
					if(lock!="false" && lock!=false && lock!="no") 
						layers_settings[i]['locked']=true;
				}else layers_settings[i]['locked']=false;
				
				//for scaling purposes
				layers_settings[i].img=jQuery(layers[i]).is("img");
							
			}	
		
		}
		
			
			
		
			
		// init controls
		var initControls = function () {		
			
			//desktop
			if (!touch){
				$thisObj.unbind('mousemove mousedown mouseup mouseleave', mouseHandler);			
				
											
				if(settings['enable']==true){
					$thisObj.bind('mousemove mouseleave', mouseHandler);		
				}
				
				if(settings['draggable']==true){
					$thisObj.bind('mousedown mouseup', mouseHandler );					
				}
			}
			
			
			// orientation support
			initOrientationControl();
			
						
			// touch screen
			if (touch){				
				$thisObj.unbind('touchstart touchend touchmove', mouseHandler);
				if(settings['draggable']==true){
					$thisObj.bind( 'touchstart touchend touchmove', mouseHandler );					
				}
			}
			
			//win8 touch, cant test, support disabled
			//if (window.navigator.msPointerEnabled) {
			//	xxxxx.addEventListener("MSPointerDown", mouseHandler, false);
			//}
			
		}
		
		
		
	
		var initOrientationControl = function(){
			if ('DeviceOrientationEvent' in window){
				window.removeEventListener('deviceorientation', mouseHandler);
				if(settings['gravitydriven']==true){
					window.addEventListener('deviceorientation', mouseHandler);
				}
			}
		}
		
		
		/* ------ OTHER FUNCTIONS ------ */
		
		var getMouseCoordinates = function( evt ){
			var clientX = null;
			var clientY = null;

			// Get the coordinates based on input type
			if( touch ){
				// Stop the default handling of the event if its not click
				if(evt.type!='touchstart') evt.preventDefault();
				
				var tch = evt.originalEvent.touches[0] || evt.originalEvent.changedTouches[0];
				
				// Get the touch coordinates				
				clientX = tch.pageX;
				clientY = tch.pageY;
				
			} else {
				// Not a tablet so grab mouse coordinates
				clientX = evt.clientX;
				clientY = evt.clientY;				
			}

			return {x:clientX, y:clientY };
		}
		
		
		var mouseHandler = function (e){
			
			switch (e.type){
			 	
				
				case 'touchmove':
				case 'mousemove': 
					
					if (lastActionTime + frameRate > Date.now()) return;
					rolledout=false;
					var evt=getMouseCoordinates(e);
					
					if(pressed){
						var dx=(-(evt.x-xy.x)/settings['width'])*Math.abs(settings['sensitivityx'])*sensitivityk;
						var dy=((evt.y-xy.y)/settings['height'])*Math.abs(settings['sensitivityy'])*sensitivityk;
						if(e.type=='mousemove'){
							vx=dx;
							vy=dy
						}else{
							vx+=dx;
							vy+=dy;
						}
					}
					else if(!dropped){
					
						if (settings['sensitivityx']!=0) {
							var scroll = $('html').scrollLeft();
							if (! scroll) scroll = $('body').scrollLeft();
							var x = evt.x - $thisObj.offset().left + scroll;
							if (x > settings['width']) x = settings['width'];
							else if (x<0) x = 0;
							vx = (x/settings['width']-0.5)*settings['sensitivityx']*sensitivityk;
							
						}else vx=0;
						
						if (settings['sensitivityy']!=0) {
							var scroll = $('html').scrollTop();
							if (! scroll) scroll = $('body').scrollTop();
							var y = evt.y - $thisObj.offset().top + scroll;
							if (y > settings['height']) y = settings['height'];
							else if (y <0) y = 0;
							vy = (-y/settings['height']+0.5)*settings['sensitivityy']*sensitivityk;
							
						}else vy=0;
					}
					
					
					if(!dropped) updateEngine();
					
					startTimer();
					
					lastActionTime = Date.now();
					
					break;
				
				
				
				case 'deviceorientation': 
					
					if (lastActionTime + frameRate*3 > Date.now() || dropped || pressed) return;
					
					//stop if angles are small
					//e.gamma=Math.abs(e.gamma)<5?0:(e.gamma>175?180:(e.gamma<-175?-180:e.gamma));
					//e.beta=Math.abs(e.beta)<5?0:(e.beta>175?180:(e.beta<-175?-180:e.beta));
					
					//////////
					if(Math.round(e.gamma)!=gamma || Math.round(e.beta)!=beta){
					
						gamma = Math.round(e.gamma);
						beta = Math.round(e.beta);
						
						var x=0,y=0;
						switch (window.orientation){
							
							case 90:					
								x=-Math.max(-0.5, Math.min(0.5, beta/90));
								y=Math.max(-45, Math.min(45, gamma + 20))/90;
								break;
							case 180:				
								x=Math.max(-0.5, Math.min(0.5, gamma/90));
								y=Math.max(-45, Math.min(45, beta + 20))/90;
								break;
							case -90:					
								x=Math.max(-0.5, Math.min(0.5, beta/90));
								y=-Math.max(-45, Math.min(45, gamma - 20))/90
								break;
							case 0:
							default:					
								if (gamma < -90 || gamma > 90) 
								gamma = Math.abs(e.gamma)/e.gamma * (180 - Math.abs(e.gamma));					
								x=-Math.max(-45, Math.min(45, gamma))/90;
								y=-Math.max(-45, Math.min(45, beta - 20))/90;
								break;
						}
						
						vx = x*Math.abs(settings['sensitivityx'])*sensitivityk*5;
						vy = -y*Math.abs(settings['sensitivityy'])*sensitivityk*5;
											
						//////////
						rolledout=false;
						updateEngine();
						startTimer();
					
					}
					lastActionTime = Date.now();
					
					break;
				
				
				case 'touchstart':					
					//if (lastActionTime + frameRate*2 > Date.now()) return;
					window.removeEventListener('deviceorientation', mouseHandler);					
										
				case 'mousedown': 
					if (touchStart + frameRate*2 > Date.now()) return;
					
					xy=getMouseCoordinates(e);
					pressed=true;
					//if(e.type=='mousedown'){
					//	vx=0;
					//	vy=0;
					//}
					dropped=false;
					updateEngine();
					stopTimer();
					
					if(e.type=='mousedown'){
						if(settings['enable']!=true) $thisObj.bind('mouseleave', mouseHandler);
						
						$thisObj.unbind('mouseup mousemove', mouseHandler)							
						.bind('mouseup mousemove', mouseHandler)
						.css('cursor','move');
					}
					
					touchStart = Date.now();
					
					break;
				
				case 'touchend':					
					touchStart = Date.now()-touchStart;
					rolledout=true;					
					
				case 'mouseup': 
				
					if(e.type=='mouseup'){
						$thisObj.unbind('mouseup', mouseHandler)					
						.css('cursor','auto');
									
						if(!settings['enable']){
							$thisObj.unbind('mousemove mouseleave', mouseHandler)
							rolledout=true;
						}
					}
					else if(touchStart>500){
						var evt=getMouseCoordinates(e);
						if(Math.abs(evt.x-xy.x)<10 && Math.abs(evt.y-xy.y)<10){
							vx=0;
							vy=0;
							stopTimer();
						}
					}
					
					pressed=false;
								
					if(vx!=0 || vy!=0){			
						updateEngine();			
						dropped=true;
						clearTimeout(dropTimer);
						dropTimer = setTimeout(resetDrop, 900);
												
						startTimer();			
					}
					
					break;
				
				
				
				case 'mouseleave':					
					$thisObj.unbind('mouseup', mouseHandler)					
					.css('cursor','auto');
					rolledout=true;
					
					if(!settings['enable']){
						$thisObj.unbind('mousemove mouseleave', mouseHandler);
						pressed=false;
					}
					
					break;
					
					
			}
		
		}
		
		
	
		// move layers
		var onEnterFrame = function (){
			
			// if its too slow - stop it
            if(Math.abs(vx)<0.001 && Math.abs(vy)<0.001) {
				stopTimer();
				if(lastActionTime < Date.now())	initOrientationControl();
				renderIndex=0;				
            }			
			
			var tempPoint,opacity=1,temp;
			
			
			
			for (var i=0; i<number_of_layers; i++){				
				if(layers_settings[i]['locked']==true) continue;
				rotate(layers_settings[i]);
				
				if(settings['fog']>0){
					opacity=layers_settings[i].z+(1-settings['fog']);
					if(opacity>0 || (opacity<=0 && layers_settings[i].o>0)){
						layers_settings[i].o=opacity;
						applyOpacity(i,opacity);
					}
				}
				
				
				if(opacity>0){
				
					//EXTENTION FOR FUTURE
					//change angle of view
					//tempPoint = setViewAngle(layers_settings[i]);
					//tempPoint = to2D(tempPoint);	
				
					tempPoint = to2D(layers_settings[i]);
					//$(layers[i]).html(Math.round(tempPoint.x-layers_settings[i].w));
					
					if(settings['imgscale']>0 && layers_settings[i].img){						
						temp=(layers_settings[i].z*settings['imgscale']+1);
						var	w=layers_settings[i].w*temp; 					
						var	h=layers_settings[i].h*temp; 					
						w=w<1?0:w;
						h=h<1?0:h;
						placeLayerTo(i, tempPoint.x-w, tempPoint.y-h);	
						scaleLayerTo(i, w, h);							
					}
					else placeLayerTo(i, tempPoint.x-layers_settings[i].w, tempPoint.y-layers_settings[i].h);	
					
				}
				
			
			}
			
			
			//sort tags not every frame to boost performance
			if(settings['zsort']==true){
				if(renderIndex%5==0){
					renderIndex-=5;
					sortTags();	
				}
				renderIndex++;
			}
			
			
			//attenuation
			if(settings['attenuation']>0 && rolledout){				
				var k=(1-settings['attenuation'])*slowdown(vx, vy);
				vx*=k;
				vy*=k;				
				updateEngine();
			}
			
			
		}
		
		
		
		
		//3d engine functions		
		
		
		var slowdown = function(nx, ny){		
			var n=Math.abs(nx)+Math.abs(ny);
			if(n>0.02) return 1;		
			return 0.98;
		};
				
		
		var resetDrop=function(){
			dropped=false;
		};
		
		//rotation engine parameters
		var updateEngine = function(){
			if(settings['sensitivityx']==0 || templateH==0) vx=0;
			if(settings['sensitivityy']==0 || templateV==0) vy=0;
			
			var speed=Math.sqrt(vx*vx+vy*vy);
			
			if(speed>settings['maxspeed']*0.01){
				speed=settings['maxspeed']*0.01/speed;
				vx*=speed;
				vy*=speed;				
			}
						
			cosVx=Math.cos(vx);
			cosVy=Math.cos(vy);
			sinVy=Math.sin(vy);
			sinVx=Math.sin(vx);			
		};
		
		//rotate point
		var rotate = function (p){				
			var temp = (p.z*cosVx+p.x*sinVx);
			p.x = p.x *cosVx-p.z*sinVx;
			p.z = temp*cosVy-p.y*sinVy;
			p.y = temp * sinVy + p.y * cosVy;			
		}
		
		
		//EXTENTION FOR FUTURE
		//TO DO: add settings for angles
		//change point of view		
		var setViewAngle = function (p){				
			var ret={};
			
			var vertical=30*(Math.PI/180);
			var horizontal=0*(Math.PI/180);
			
			var cosVx=Math.cos(horizontal);
			var cosVy=Math.cos(vertical);
			var sinVy=Math.sin(vertical);
			var sinVx=Math.sin(horizontal);	
			
			var temp = (p.z*cosVx+p.x*sinVx);			
			ret.x = p.x *cosVx-p.z*sinVx;
			ret.z = temp*cosVy-p.y*sinVy;
			ret.y = temp * sinVy + p.y * cosVy;
			return ret;
		}
		
		
		//  get projection to 2D  
		var to2D = function(p){
			var temp = (p.z*settings['perspective']+1)*0.5;
			return {x: (p.x*temp+0.5)*settings['width'], y: (p.y*temp+0.5)*settings['height']};
		}
		
		
		
		
		// start timer 
		var startTimer = function(){
			deletePause();
			
			//start
			if(timerId==-1){
				updateEngine();
				timerId=setInterval(onEnterFrame, frameRate);				
			}			
		}
		
		
		// stop timer
		var stopTimer = function(){
			clearInterval(timerId);
            timerId = -1;
		}
		
		
		//delete pause
		var deletePause = function(){
			//clear pause if any
			if(timeoutID!=-1){
				clearTimeout(timeoutID);
				timeoutID=-1;
			}
		}
		
		
		// place layer i to x, y coordinates
		var placeLayerTo = function(i, x, y){
			layers[i].style.left=(x | 0)+'px';
			layers[i].style.top=(y | 0)+'px';			
		}
        
		// resize layer i to w, h
		var scaleLayerTo = function(i, w, h){			
			layers[i].style.width=(w*2 | 0)+'px';			
			layers[i].style.height=(h*2 | 0)+'px';			
		}
        
		
		

		//sort tags by Z coordinate
		var sortTags = function(){			
			var dd=[$(layers[0]).data('ztemp')];			
			
			for (var i = 0; i < number_of_layers; i++) {			
				
				for(var j=i+1;j<number_of_layers;j++){									
					if(i==0) dd[j]=$(layers[j]).data('ztemp');
					if((layers_settings[i].z<layers_settings[j].z && dd[j]<dd[i]) || (layers_settings[i].z>layers_settings[j].z && dd[i]<dd[j])) {					
						dd[number_of_layers]=dd[i];
						dd[i]=dd[j];
						dd[j]=dd[number_of_layers];	
						
					}
				}
				
				$(layers[i]).data('ztemp',dd[i]).css('z-index', dd[i]); //save z index
				
			}
			
		};
		
				
		
		//for correct positioning, in case if images are loaded after initialization
		var accountForImages = function(){		
			var $img;	
			var nimg=[];
			var img=[];
					
			for (var i = 0; i < number_of_layers; i++) {
				
				if(layers_settings[i].img){ 
					$img=$(layers[i]);
					layers_settings[i].img=false;//to avoid scaling while loading
					img[i]=true;
				}
				else{
					$img=$(layers[i]).find('img');
					img[i]=false;
				}
				
				nimg[i]=$img.length;					
			
				$img.each(function(){					
					jQuery.data(this, 'layerindex', i);
				})
				.one('load',function () {					
					var that=$(this);
					var i=jQuery.data(this, 'layerindex');
					nimg[i]--;
					
					if(nimg[i]==0){
						var l=$(layers[i]);												
						layers_settings[i].w=l.width()/2;
						layers_settings[i].h=l.height()/2;
						layers_settings[i].img=img[i];
						that.show();
						startTimer(); //or enterframe
					}
					
				}).each(function () {				
					var that=$(this);
					if (this.complete && this.width>0) {											
						that.trigger('load'); //trigger load						
					}				
					else{
						that.hide();						
						//setTimeout(function() {that.trigger('load');}, 5000);
					}
				});	

			}
			
		}
		
	
		var resetScale = function(){
			for (var i = 0; i < number_of_layers; i++) {
				if(layers_settings[i].img)
				scaleLayerTo(i, layers_settings[i].w, layers_settings[i].h);
			}
		};
		
		
		// ------ TEMPLATE FUNCTIONS ------ 
		var createXYZ = function(i, l) {
			var p;
			
			switch(settings['template']) {				
				case 1: p = sphereUnit(i, l); break;
				case 2: p = sphere(i, l, true); break;
				case 3: p = sphere(i, l, false); break;
				case 4: p = cilinder(i, l, true); templateH = 0; break;
				case 5: p = cilinder(i, l, false); templateV = 0; break;
				case 6: p = cone(i, l); templateV = 0; break;
				case 7: p = circle(i, l); break;
				case 8: p = cross(i, l); break;
				case 9: p = rectangle(i, l); break;											
				default: p = randomCube(); break;
			}
			return p;
		}
		
		
		var randomCube = function(i,l) {			
			return {x:Math.random()*2-1, y:Math.random()*2-1, z:Math.random()*2-1 };		
		}
		
		
		var var1=0, var2=0;	
		var sphereUnit =function (i, n) {						
			if(i==0) return angle2x(Math.PI, 0);
			if(i==n-1) return angle2x(0, 0);
						
			n=n<2?2:n;			
			var a = 1 - 1/(n>3?n-3:n);
			var b = 0.5*(n+1)/(n>3?n-3:n);
			var h = -1 + 2*(a*(i+1) + b-1)/(n-1);
			var r=Math.sqrt(1-h*h);
			
			a = Math.acos(h);
			b = (var2 + 3.6/Math.sqrt(n)*2/(var1+r))%(2*Math.PI);
			 
			var1=r;
			var2=b;
						
			return angle2x(a, b);		
		};
		
		
		var angle2x = function(a,b){
			var z=Math.cos(a);							
			var x=Math.sin(a)*Math.cos(b);
			var y=Math.sin(a)*Math.sin(b);
			return {x:x,y:y,z:z};
		};
		
		
		
		var sphere =function (i, l, uniform) {
			l = l < i?i:l;			
			var k=uniform?0.8*Math.PI/l:Math.PI/l;			
			var d=0.1*Math.PI;			
			var x,z,a,y;
			
			if (uniform) {				
				return angle2x(i*k+d, i*10*k+d);				
			}else {
				a=Math.random()*l;
				d=Math.random()*l*2;				
				return angle2x(a*k, d*k);	
			}							
		}
		
				
		var circle =function (i, l) {
			l = l < i?i:l;		
			var x=Math.sin(Math.PI*2*i/l);
			var y=Math.cos(Math.PI*2*i/l);					
			return {x:x,y:y,z:0};			
		}
		
		
		var line =function(i, l) {					
			return {x:0,y:2*i/l-1,z:0};			
		}
		
		
		var cross =function (i, l) {
			l = l < i?i:l;		
			var direction = Math.PI * 0.25+Math.PI*2*(i%4)/4;
			var r = Math.ceil((i+1)/4)*4/l;
			var x=r*Math.sin(direction);
			var y=r*Math.cos(direction);					
			return {x:x,y:y,z:0};		
		}
		
		
		var rectangle=  function (i, l) {
			l = l < i?i:l;
			var d = 8 * i / l;
			var x, y;
			if (d < 2) { x = d-1; y = -1;}
			else if (d < 4) { x = 1; y = d-3;}
			else if (d < 6) { x = 5-d; y = 1;}
			else { x = -1; y = 7-d; }
						
			return {x:x,y:y,z:0};			
		}
		
				
		//**************surface of the cilinder,  uniform distribution ***************************
		var cilinder = function (i, l, vh){
			var _maximumZDepth = 1;// Math.sqrt(2);
			var k=2.2*2*Math.PI/l;			
			
			var x=2*(i/l-0.5)/_maximumZDepth;
			var z=Math.cos(i*k)/_maximumZDepth;				
			var y= Math.sin(i * k) / _maximumZDepth;
					
			return {x:vh?x:y, y:vh?y:x, z:z};
		}
		
		
		//**************surface of the konus,  uniform distribution ***************************
		var cone = function (i, l){			
			var _maximumZDepth = 1;// Math.sqrt(2);
			var k=3*2*Math.PI/l;				
			
			var y=2*(Math.pow(i/l,0.8)-0.5)/_maximumZDepth;
			var z=i*Math.cos(i*k)/(l*_maximumZDepth);				
			var x=i*Math.sin(i*k)/(l*_maximumZDepth);
			
			return {x:x, y:y, z:z};
		}
		
		
		// converts strings to boolean or number
		var parseValue = function (x) {	
			var lower=x.toLowerCase();
			if(lower==String("false") || lower==String("no")) return false;
			if(lower==String("true") || lower==String("yes")) return true;
			
			var ret=parseFloat(x);
			if(isNaN(ret)==false) return ret;
			
			return x;
		}
		
		
		//confirm settings (fool proof)
		var checkSettings = function(){
			
			if(settings['width']<=0) settings['width']=150;
			if(settings['height']<=0) settings['height']=150;
			//settings['template']=settings['template']<0?0:(settings['template']>10?10:settings['template']);
			
			if(settings['fog']<0) settings['fog']=0;
			if(settings['fps']<1) settings['fps']=1;
			if(settings['fpsmobile']<1) settings['fpsmobile']=1;
			if(settings['hwratio']<=0) settings['hwratio']=1;
			
			if(settings['maxspeed']<0) settings['maxspeed']=0;
			
			if(settings['attenuation']<0) settings['attenuation']=0;
			else if(settings['attenuation']>1) settings['attenuation']=1;
			
			if(settings['fadein']<0) settings['fadein']=0;
			if(settings['scale']<0) settings['scale']=0;
			else if(settings['scale']>1) settings['scale']=1;
			
		}
		
		
		/* ------ PUBLIC PARALLAX FUNCTIONS ------ 
			option(property:String, value:*) 
			
			pause(t:Number)
			unpause()
			triggerPause()
			stop()	
			toggleMouse()
			mouseTo(p:Object)		
			mouseToRandom()
			reset()	
		*/
				
		
		//options set/get
		this.option = function(prop, n){	
			//fool proof
			if(typeof prop != 'undefined'){
				
				prop=prop.replace(/^\s+|\s+$/g, "");				
				if(typeof settings[prop] === 'undefined') return $thisObj;			
				if(typeof n == 'undefined') return settings[prop];
				
				var oldValue=settings[prop];
				
				if(typeof n == 'string'){
					n=n.replace(/^\s+|\s+$/g, '');					
					settings[prop]=parseValue(n);
				}else if(typeof n == 'boolean' || typeof n == 'number' || typeof n == 'function') settings[prop]=n;
				
				//if value didnt change - do nothing
				if(oldValue===settings[prop]) return;
				
				//check settings
				checkSettings();
				
				//do some action on update settings
				if(prop=='enable' || prop=='draggable'){initControls();}
				else if(prop=='gravitydriven'){initOrientationControl();}
				else if(prop=='template'){
					
					if(settings['fadein']>1){						
						$thisObj.fadeOut(settings['fadein'],function() {
							stopTimer();
							applyTemplate();
							startTimer();
							$thisObj.fadeIn(settings['fadein']);
						});
					}else{
						applyTemplate();
					}
	
				}else if(prop=='scale'){					
					vx=0;
					vy=0;					
					applyTemplate();
				}else if(prop=='fps' || prop=='fpsmobile'){
					sensitivityk=touch?(30/settings['fpsmobile']):(60/settings['fps']);					
					frameRate = Math.round(1000 / (touch?settings['fpsmobile']:settings['fps']));
					
					stopTimer();
					startTimer();
				}else if(prop=='width'){
					//next line will remove responsible feature, comment them to avoid it
					$thisObj.width(settings['width']);
					settings['hwratio']=settings['height']/settings['width'];
					onresize();
				}else if(prop=='height'){					
					$thisObj.height(settings['height']);
					settings['hwratio']=settings['height']/settings['width'];
					onresize();
				}else if(prop=='hwratio'){				
					onresize();					
				}else if(prop=='perspective'){
					startTimer();
				}else if(prop=='imgscale'){					
					if(settings['imgscale']==0){
						resetScale();
					}else if(timerId==-1){
						onEnterFrame();
					}						
				}else if(prop=='fog'){				
					
					//onEnterFrame();
					if(settings['fog']==0){
						$(layers).css({opacity: 1});
					}
					startTimer();						
				}

			}
		}
		
		
				
		//enable/disable mouse
		this.toggleMouse = function(){			
			settings['enable']=!settings['enable'];
			initControls(); 
		}
		
		
		//pause tagsCloud effect
		this.pause = function(t){			
			if(timerId!=-1){
				stopTimer();
				if(t>0){	
					deletePause(); 
					timeoutID=setTimeout(startTimer,t);
				}
			}
		}
		
		
		//update tagsCloud effect
		this.update = function(){
			saveSize();
			onEnterFrame();
		}
		
		
		//unpause tagsCloud effect
		this.unpause = function(){
			startTimer();
		}
		
		
		//trigger pause 
		this.triggerPause = function(){
			if(timerId!=-1){
				stopTimer();			
			}
			else startTimer();
		}
		
		
		//stop tagsCloud effect
		this.stop = function(){
			vx=0;
			vy=0;
			updateEngine();
			startTimer();
		}
		
				
		//imitate mouse movement to x, y
		this.mouseTo = function (target) {			
			//if it contains coordinates
			if (typeof target == 'object'){
				var temp=parseFloat(target.x);
				if (!isNaN(temp)) vx=settings['sensitivityx']*temp/100;
				temp=parseFloat(target.y);
				if (!isNaN(temp)) vy=settings['sensitivityx']*temp/100;
				rolledout=true;
				updateEngine();
				startTimer();				
			}			
		}
				
		
		//imitate mouse movement to random position
		this.mouseToRandom = function () {
			vx=(0.5-Math.random())*settings['sensitivityx'];
			vy=(0.5-Math.random())*settings['sensitivityx'];	
			rolledout=true;
			updateEngine();
			startTimer();			
		}
		
		
		//imitate mouse movement to the center and reset template
		this.reset = function () {			
			vx=0;
			vy=0;
			applyTemplate();
		}
		
		
		//full re-initialization with new layers (if any)
		this.reinit = function (txt) {			
			vx=0;
			vy=0;
			stopTimer();
			layers.unbind('click', tagClicked);
			$thisObj.find('img').unbind();
			if(typeof txt !='undefined' && txt!='') $thisObj.html(txt);			
			init();
		}
		
			
		
		/* ------ INIT tagsCloud ------ */		
		init();
		
		
	}

	
	
	/* ------ ENTRY POINT  ------ */
	
	// plugin name
	var plugin = 'cloud';
	
	// everything starts here
	$.fn[plugin] = function(settings) {
		
		var args = arguments;
		var $thisObj;
		var instance;
		
		if (this.length == 0) return false;
		
		$thisObj = $(this);
		instance = $thisObj.data(plugin);
		
		if (!instance) {			
			//create tagsCloud
			if (typeof settings === 'object' || !settings){
				return $thisObj.data(plugin,  new tagsCloudEffect($thisObj, settings));	
			}
		} else {
			//interact with tagsCloud by calling its functions			
			if (instance[settings]) {				
				return instance[settings].apply(this, Array.prototype.slice.call(args, 1));
			}
		}

	};
	
	
	
})(Echo.jQuery, Echo.jQuery); 
