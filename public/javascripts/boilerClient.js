const toggleButton = document.getElementById('toggleBtn');
const btnMsg = document.getElementById("btnMsg");

const onOffBtn = document.getElementById('onOffButton');

const testBtn = document.getElementById("testBtn");

const heatReqCont = document.getElementById("heatReqCont");

const boilerOnCont = document.getElementById("boilerOnCont");

const boilerStateCont = document.getElementById("boilerStateCont");

const faultMsg = document.getElementById("faultMsg");

var boilerStatusReqInterval = 30 * 1000; //30 sec

const setOnOffBtnMsg = function(state){
	var boilerOnMsg = "";
	if(state === true){
		onOffBtn.innerHTML = '<div style = "display: table;" ><div class= "button-indicator on"></div> Turn Off </div>';
		onOffBtn.classList.add('on');
		onOffBtn.value = true;
		
		boilerOnMsg = "On";
		boilerOnCont.classList.remove('fault');
		boilerOnCont.classList.add('running');
	} else {
		onOffBtn.innerHTML = '<div style = "display: table;" ><div class= "button-indicator off"></div>  Turn On </div>';
		onOffBtn.classList.remove('on');
		onOffBtn.value = false;
		
		boilerOnMsg = "Off";
		boilerOnCont.classList.remove('running');
		boilerOnCont.classList.add('fault');
	}
	
	boilerOnCont.innerHTML = '<div class= "boiler-status-msg">' + boilerOnMsg +'</div>';
}

const fetchBoilerStatus = function(){
	
  fetch('/boilerMonitor/boiler-status', {method: 'GET'})
    .then(function(response) {
      if(response.ok) {
		return response.json();
      }
      throw new Error('Request failed.');
    })
    .catch(function(error) {
      console.log(error);
    }).then(function(boilerState) {
        setBoilerStatus(boilerState);
	});
};

fetchBoilerStatus();

setInterval( function () { 
	fetchBoilerStatus();
}, boilerStatusReqInterval );


const setBoilerStatus = function(boilerState){
	
	var heatReqMsg = "";
	if(boilerState.heatRequestStatus){
		heatReqMsg = "Yes";
		heatReqCont.classList.remove('fault');
		heatReqCont.classList.add('running');
	} else {
		heatReqMsg = "No";
		heatReqCont.classList.remove('running');
		heatReqCont.classList.add('fault');
	}
	heatReqCont.innerHTML = '<div class= "boiler-status-msg">' + heatReqMsg +'</div>'
	
	setOnOffBtnMsg(boilerState.switchState);

	boilerStateCont.className = '';
	boilerStateCont.classList.add('boiler-status-msg-container');
	
	var boilerStateMsg = "";
	switch ( boilerState.boilerStateInd){
		case 0:
			boilerStateMsg = "Idle"
			boilerStateCont.classList.add('idle');
		break;
		case 1:
			boilerStateMsg = "Heating up"
			boilerStateCont.classList.add('heating');
		break;
		case 2:
			boilerStateMsg = "Running"
			boilerStateCont.classList.add('running');
		break;
		case 3:
			boilerStateMsg = "Fault"
			boilerStateCont.classList.add('fault');
		break;
		default: 
			boilerStateMsg = "Idle"
			boilerStateCont.classList.add('idle');
		break;
	}
	boilerStateCont.innerHTML = '<div class= "boiler-status-msg">' + boilerStateMsg +'</div>'
	
	
	if( boilerState.boilerStateInd !== 3 ){
		faultMsg.classList.add('hidden');
	}else{
		faultMsg.classList.remove('hidden');
	}
}


const setAllButtonStates = function(state){
	const buttons = document.getElementsByTagName('button');
	for(i = 0;i < buttons.length; i++) {
	  buttons[i].disabled = state;
	};
}

testBtn.addEventListener('click', function(e) {
  
  fetch('/boilerMonitor/test', {method: 'POST'})
    .then(function(response) {
      if(response.ok) {
        return;
      }
      throw new Error('Request failed.');
    })
    .catch(function(error) {
      console.log(error);
    });
});

toggleButton.addEventListener('click', function(e) {
  btnMsg.innerHTML = 'Toggling...';
  setAllButtonStates(true); //disable all buttons while the servo is working
  
  fetch('/boilerMonitor/toggle', {method: 'POST'})
    .then(function(response) {
      if(response.ok) {
        btnMsg.innerHTML = 'Toggle Success!';
        return;
      }
      throw new Error('Request failed.');
      btnMsg.innerHTML = 'Toggle Failure';
    })
    .catch(function(error) {
      console.log(error);
    }).finally(function() {
		setTimeout( function () { 
			setAllButtonStates(false);
			btnMsg.innerHTML= '';
			}, 2000 );
	})
});

onOffBtn.addEventListener('click', function(e) {
  var postUrl = '';
  var valueSet;
  if(onOffBtn.value === "true"){
		postUrl = '/boilerMonitor/off'
		valueSet = false;
	} else {
		postUrl = '/boilerMonitor/on'
		valueSet = true;
	}
  setAllButtonStates(true); //disable all buttons while the servo is working
  btnMsg.innerHTML = 'Working...'
  setOnOffBtnMsg(valueSet);
  
  fetch( postUrl, {method: 'POST'})
    .then(function(response) {
      if(response.ok) {
        btnMsg.innerHTML = 'Switch Success!';
        setAllButtonStates(false); //enable all buttons 
        return;
      }
      throw new Error('Request failed.');
      btnMsg.innerHTML = 'Switch Failure';
      setOnOffBtnMsg(!valueSet);
    })
    .catch(function(error) {
      console.log(error);
    }).finally(function() {
		setTimeout( function () { 
			setAllButtonStates(false); //enable all buttons 
			btnMsg.innerHTML= '';
			}, 2000 );
	})
});


