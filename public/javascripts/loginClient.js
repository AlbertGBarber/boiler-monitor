const loginBtn = document.getElementById("loginBtn");

const registerBtn = document.getElementById("registerBtn");


loginBtn.addEventListener('click', function(e) {
  
  fetch('/login', {method: 'POST'})
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

registerBtn.addEventListener('click', function(e) {
  
  fetch('/register', {method: 'POST'})
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
