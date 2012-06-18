$(function(){
  window.scrollTo(0,1);

  // Bind the event.
  $(window).hashchange( function(){
    if (location.hash === '#page2') {
      // Alerts every time the hash changes!
      forge.file.getImage(function(file) {
        forge.file.imageURL(file, function(url) {
          $('a#photo-button').click();
        });
      });
    };

    if (location.hash === '#page6') {
      setTimeout(function() {
        $("#page6 a").first().click();
      }, 3500);
    };
  })

  $("#page12 a.button.visible").click(function(event) {
    event.preventDefault();

    // from http://thejimgaudet.com/articles/support/web/jquery-e-mail-validation-without-a-plugin/
   function validateEmail($email) { var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/; return $email != '' && emailReg.test( $email );}

    if (validateEmail($("#textinput7").val())) {
      $("#page12 a.hidden.button").click();
    } else {
      alert("no valid email");
    };
  });
});
