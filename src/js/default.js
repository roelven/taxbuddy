forge.logging.info("Start your app here!");

forge.file.getImage(function(file) {
	forge.file.imageURL(file, function(url) {
		document.getElementById('image').setAttribute('src', url);
	});
});

