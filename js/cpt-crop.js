jQuery(document).ready(function($) {
	var pluginpath = '../wp-content/plugins/crop-thumbnails';
	var adminAjaxPath = '../wp-admin/admin-ajax.php';

	//setup for ajax connections
	$.ajaxSetup({
		type: 'POST',
		url: adminAjaxPath,
		cache: false,
		timeout: (30 * 1000)
	});

	//cropping object: holds jcrop-object and image to use the crop on
	var cropping = {
		api: -1,
		img: $('.selectionArea img')
	};

	/*needed cause the js-logic is currently not handle the hidden objects in dependence with "select all of the same ratio"*/
	$('.thumbnail-list li.hidden').remove();

	cropping.img.fadeTo(0, 0.3);

	//handle click on an entry
	$('.thumbnail-list li').click(function() {
		selectAllWithSameRatio($(this));
		activateArea(cropping);
	});


	//handle checkbox for selecting all with same ratio
	$('#cpt-same-ratio').change(function() {
		var active = $('.thumbnail-list li.active');
		if ($(this).attr('checked') === 'checked') {
			if (active.length > 0) {
				selectAllWithSameRatio($(active[0]));
				activateArea(cropping);
			}
		} else {
			if (active.length > 1) {
				$('.thumbnail-list li').removeClass('active');
				deactivateArea(cropping);
			}
		}
	});


	$('#cpt-deselect').click(function() {
		$('.thumbnail-list li.active').removeClass('active');
		deactivateArea(cropping);
	});


	$('#cpt-generate').click(function() {
		var active = $('.thumbnail-list li.active');
		if (active.length === 0) {
			alert(cpt_lang.selectOne);
			return;
		}
		var selection = cropping.api.tellSelect();
		if (active.length > 0 && selection.w > 0 && selection.h > 0) {
			doProcessing(active, cropping);
		}
	});


	$('.cpt-debug .cpt-debug-handle').click(function(e) {
		e.preventDefault();
		$('.cpt-debug').toggleClass('closed');
	});

	/********************************/
	function doProcessing(active, cropping) {
		var active_array = [];
		active.find('img').each(function() {
			active_array.push("<li>" + $(this).data('values').name + "</li>");
		});
		smoke.confirm(cpt_lang.saveAlert.replace(/%list%/, "<ul class='file-list'>" + active_array.join("") + "</ul>"), function(e) {
			if (e) {
				afterProcessingConfirm(active, cropping);
			} else {

			}
		}, {
			ok: cpt_lang.yes,
			cancel: cpt_lang.no,
			classname: "custom-class",
			reverseButtons: true
		});
	}
	function afterProcessingConfirm(active, cropping) {
		/*console.log('doProcessing');*/


		var active_array = [];
		active.find('img').each(function() {
			active_array.push($(this).data('values'));
		});

		$('.mainWindow').hide();
		$('.waitingWindow').show();

		$.ajax({
			data: {
				action: 'cptSaveThumbnail',
				'_ajax_nonce': cpt_ajax_nonce,
				cookie: encodeURIComponent(document.cookie),
				selection: JSON.stringify(cropping.api.tellSelect()),
				raw_values: JSON.stringify(cropping.img.data('values')),
				active_values: JSON.stringify(active_array),
				same_ratio_active: $('#cpt-same-ratio').is('checked')
			},
			complete: function() {
				$('.mainWindow').show();
				$('.waitingWindow').hide();
			},
			success: function(response) {
				try {
					var result = JSON.parse(response);

					if (cpt_debug_js) {
						console.log('Save Function Debug', result.debug);
					}

					if (typeof result.success == "number") {

						if (result.changed_image_format) {
							window.location.reload();
						} else {
							doCacheBreaker(result.success);
						}
					} else {
						//saving fail
						alert(result.error);
					}
				} catch (e) {
					alert(e.message + "\n" + response);
				}

			}
		});
	}

	function doCacheBreaker(number) {
		$('.thumbnail-list li img').each(function() {
			var imgurl = $(this).attr('src');
			var last = imgurl.lastIndexOf('?');
			if (last < 0) {
				imgurl += '?' + number;
			} else {
				imgurl = imgurl.substring(0, last) + '?' + number;
			}
			$(this).attr('src', imgurl);
		});
	}

	function selectAllWithSameRatio(elem) {
		$('.thumbnail-list li').removeClass('active');
		if ($('#cpt-same-ratio').attr('checked') === 'checked') {
			var ratio = elem.attr('rel');
			var elements = $('.thumbnail-list li[rel="' + ratio + '"]');
			elements.addClass('active');
		} else {
			elem.addClass('active');
		}
	}


	function deactivateArea(c) {
		if (c.api != -1) {
			c.api.release();
			c.api.disable();
		}
		$("#cpt-upload,#cpt-delete").attr("disabled", true);
	}

	function activateArea(c) {
		deactivateArea(c);
		var allActiveThumbs = $('.thumbnail-list li.active img');
		var largestWidth = 0;
		var largestHeight = 0;
		var ratio = 0;
		var crop = true;

		$("#cpt-upload,#cpt-delete").removeAttr("disabled");

		//get the options
		allActiveThumbs.each(function() {

			var img_data = $(this).data('values');
			if (ratio === 0) {
				ratio = img_data.ratio; //initial
			}
			if (ratio != img_data.ratio) {
				console.info('Crop Thumbnails: print ratio is different from normal ratio on image size "' + img_data.name + '".');
			}

			//we only need to check in one dimension, cause per definition all selected images have to use the same ratio
			if (img_data.width > largestWidth) {
				largestWidth = img_data.width;
				largestHeight = img_data.height;
			}

			//crop also has to be the same on all selected images
			if (img_data.crop == 1) {
				crop = true;
			} else {
				crop = false;
			}
		});

		var scale = 0;
		if (ratio >= 0) {
			scale = c.img.data('values').height / largestHeight;
		} else {
			scale = c.img.data('values').width / largestWidth;
		}

		var preSelect = [0, 0, Math.round(scale * c.img.width()), Math.round(scale * c.img.height())];
		var minSize = [largestWidth, largestHeight];
		// END get the options

		//set the options
		var options = {};
		options.boxWidth = c.img.width();
		options.boxHeight = c.img.height();
		options.trueSize = [cropping.img.data('values').width, c.img.data('values').height];
		options.aspectRatio = ratio;
		options.setSelect = preSelect;

		if (largestWidth > cropping.img.data('values').width || largestHeight > cropping.img.data('values').height) {
			alert(cpt_lang.warningOriginalToSmall);
		} else {
			options.minSize = minSize;
		}

		//correct some options
		if (ratio >= 0) {
			//add a offset to move the selection in the middle
			var crop_offset = (cropping.img.data('values').width - scale * largestWidth) / 2;
			options.setSelect = [crop_offset, 0, cropping.img.data('values').width, Math.round(scale * c.img.height())];
		} else {
			//no offset cause in most cases the the selection is needed in the upper corner (human portrait)
			options.setSelect = [0, 0, Math.round(scale * c.img.width()), cropping.img.data('values').height];
		}

		if (scale === Infinity) {
			options.setSelect = [0, 0, Math.round(scale * c.img.width()), cropping.img.data('values').height];
		}

		//free scaling
		if (!crop) {
			options.aspectRatio = false;
			options.setSelect = [0, 0, cropping.img.data('values').width, cropping.img.data('values').height];
			console.log('free scaling');
		}

		//debug
		if (cpt_debug_js) {
			console.log('choosed image - data', c.img.data('values'));
			console.log('JCrop - options', options);
		}

		c.api = $.Jcrop(c.img, options);
	}



	function doUpload() {
		var fr = new FileReader;
		var file = (this.files[0]);

		fr.onload = function() { // file is loaded
			var img = new Image;

			img.onload = function() {
				testUploadExpectedSize(img.width, img.height, file);
			};

			img.src = fr.result; // is the data URL because called with readAsDataURL
		};

		fr.readAsDataURL(this.files[0]);
	}
	function testUploadExpectedSize(imgW, imgH, file) {
		var allActiveThumbs = $('.thumbnail-list li.active');
		var first = allActiveThumbs.find('img').eq(0);
		var expectedWidth = first.data("values").width;
		var expectedHeight = first.data("values").height;

		if (expectedWidth != imgW || expectedHeight != imgH) {
			smoke.confirm(cpt_lang.uploadNoMatch.replace(/%img%/, imgW + "x" + imgH).replace(/%expected%/, expectedWidth + "x" + expectedHeight), function(e) {
				if (e) {
					promptUpload(file);
				} else {

				}
			}, {
				ok: cpt_lang.yes,
				cancel: cpt_lang.no,
				classname: "custom-class",
				reverseButtons: true
			});
		} else {
			promptUpload(file);
		}
	}
	function promptUpload(file) {
		var allActiveThumbs = $('.thumbnail-list li.active');
		var active_array = [];



		allActiveThumbs.find('img').eq(0).each(function() {
			active_array.push("<li>" + $(this).data('values').name + "</li>");
		});
		smoke.confirm(cpt_lang.saveAlert.replace(/%list%/, "<ul class='file-list'>" + active_array.join("") + "</ul>"), function(e) {
			if (e) {
				afterUploadConfirm(file);
			} else {

			}
		}, {
			ok: cpt_lang.yes,
			cancel: cpt_lang.no,
			classname: "custom-class",
			reverseButtons: true
		});
	}
	function afterUploadConfirm(file) {
		var allActiveThumbs = $('.thumbnail-list li.active img');
		var firstActiveThumb = null
		if (!allActiveThumbs.size()) {
			return;
		}
		//get the first
		firstActiveThumb = allActiveThumbs[0];
		var img_data = $(firstActiveThumb).data('values');

		console.log("selected an upload on thumb", img_data.width, img_data.height);
		var formData = new FormData();
		formData.append("file", file);
		formData.append("width", img_data.width);
		formData.append("height", img_data.height);
		formData.append("raw_values", JSON.stringify(cropping.img.data('values')));
		formData.append("action", "cptUploadThumbnail");
		$.ajax({
			url: "admin-ajax.php",

			type: "POST",
			data: formData,
			processData: false,
			contentType: false,
			success: function(ret) {
				ret = ret && JSON.parse(ret);
				if (ret && ret.success)
					doCacheBreaker(ret.success);
				else
					smoke.alert(cpt_lang.uploadProblems);
			}
		})
	}
	$("#cpt-upload").click(function() {
		$("#theFile").click();
	});

	function promptDelete(file) {
		var allActiveThumbs = $('.thumbnail-list li.active');
		var active_array = [];



		allActiveThumbs.find('img').eq(0).each(function() {
			active_array.push("<li>" + $(this).data('values').name + "</li>");
		});
		smoke.confirm(cpt_lang.deleteAlert.replace(/%list%/, "<ul class='file-list'>" + active_array.join("") + "</ul>"), function(e) {
			if (e) {
				afterDeleteConfirm(file);
			} else {

			}
		}, {
			ok: cpt_lang.yes,
			cancel: cpt_lang.no,
			classname: "custom-class",
			reverseButtons: true
		});
	}
	function afterDeleteConfirm(file) {
		var allActiveThumbs = $('.thumbnail-list li.active img');
		var firstActiveThumb = null
		if (!allActiveThumbs.size()) {
			return;
		}
	
		//get the first
		firstActiveThumb = allActiveThumbs[0];
		var img_data = $(firstActiveThumb).data('values');

		console.log("selected an upload on thumb", img_data.width, img_data.height);
		var formData = new FormData();
		formData.append("width", img_data.width);
		formData.append("height", img_data.height);
		formData.append("raw_values", JSON.stringify(cropping.img.data('values')));
		formData.append("action", "cptDeleteThumbnail");
		formData.append("active_values", JSON.stringify([img_data]));
		$.ajax({
			url: "admin-ajax.php",

			type: "POST",
			data: formData,
			processData: false,
			contentType: false,
			success: function(ret) {
				ret = ret && JSON.parse(ret);
				if (ret && ret.success){
					//remove selected
					$(firstActiveThumb).parent().remove()
				}
				else
					smoke.alert(cpt_lang.deleteProblems);
			}
		})
	}
	$("#cpt-delete").click(function() {
		promptDelete();
	});
	$("#theFile").change(doUpload);
});


