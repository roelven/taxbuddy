$(function(){

  // Bind the event.
  $(window).hashchange( function(){
    if (location.hash == "#page2") {
      // Alerts every time the hash changes!
      forge.file.getImage(function(file) {
        forge.file.imageURL(file, function(url) {
          $("#page2 a").first().click()
        });
      });
    }
  })
});
