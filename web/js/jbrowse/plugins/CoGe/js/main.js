var coge_plugin;
define([
		   'dojo/_base/declare',
		   'dojo/_base/array',
		   'dojo/on',
		   'dojo/Deferred',
		   'dijit/Dialog',
		   'dijit/form/Button',
		   'JBrowse/View/Dialog/WithActionBar',
		   'JBrowse/View/ConfirmDialog',
		   'JBrowse/View/InfoDialog',
		   'JBrowse/Plugin'
	   ],
	   function(
		   declare,
		   array,
		   on,
		   Deferred,
		   Dialog,
		   Button,
		   ActionBarDialog,
		   ConfirmDialog,
		   InfoDialog,
		   JBrowsePlugin
	   ) {
	var BusyDialog = declare(ActionBarDialog, {
	    refocus: false,
	    autofocus: false,
		_fillActionBar: function( actionBar ) {
            new Button({
                className: 'OK',
                label: 'OK',
                onClick: dojo.hitch(this,'hide'),
                style: { display: 'none'}
            })
            .placeAt(actionBar);
    	},
	    hide: function() {
	        this.inherited(arguments);
	        array.forEach( this._extraEvents, function( e ) { e.remove(); });
	        this.destroyRecursive();
	    },
	    hideIfVisible: function() {
	        if( this.get('open') )
	            this.hide();
	    },
	    show: function() {
	        this.inherited( arguments );
	        this._extraEvents = [];
	        var underlay = ((dijit||{})._underlay||{}).domNode;
	        if( underlay ) {
	            this._extraEvents.push(
	                on( underlay, 'click', dojo.hitch( this, 'hideIfVisible' ))
	            );
	        }
	    }
	});

	// ----------------------------------------------------------------

	var PromptDialog = declare(ActionBarDialog, {
	    _fillActionBar: function( actionBar ) {
	            new Button({
	                className: 'Cancel',
	                label: 'Cancel',
	                onClick: dojo.hitch(this,'hide')
	            })
	            .placeAt( actionBar);
	            new Button({
	                className: 'OK',
	                label: 'OK',
	                onClick: dojo.hitch(this,'ok')
	            })
	            .placeAt( actionBar);
	    },
	    hide: function() {
	        this.inherited(arguments);
	        array.forEach( this._extraEvents, function( e ) { e.remove(); });
	    },
	    hideIfVisible: function() {
	        if( this.get('open') )
	            this.hide();
	    },
	    ok: function() {
	    	var value = dojo.byId('prompt_value').value;
	    	if (!value) {
	    		coge_plugin.info('Value Required', 'Please enter a value');
	    		return;
	    	}
	    	this.on_ok(value);
	    	this.hide();
	    },
	    show: function(on_ok) {
	        this.inherited( arguments );
	        this.on_ok = on_ok;
	        this._extraEvents = [];
	        var underlay = ((dijit||{})._underlay||{}).domNode;
	        if( underlay ) {
	            this._extraEvents.push(
	                on( underlay, 'click', dojo.hitch( this, 'hideIfVisible' ))
	            );
	        }
	    }
	});

	// ----------------------------------------------------------------

	var SearchNav = declare(null, {
		constructor: function(search_id, results, browser) {
			this.results = results;
			this.browser = browser;
			this.hit = 0;
			this.div = dojo.create('div', { id: 'nav_' + search_id, style: { background: 'white', opacity: 0.7, position: 'absolute' } }, dojo.byId('container'));
			coge_plugin.adjust_nav(search_id);
			dojo.create('span', { className: 'glyphicon glyphicon-step-backward', onclick: dojo.hitch(this, function() { this.go_to(0) }), style: { cursor: 'pointer' } }, this.div);
			dojo.create('span', { className: 'glyphicon glyphicon-chevron-left', onclick: dojo.hitch(this, function() { if (this.hit > 0) this.go_to(this.hit - 1) }), style: { cursor: 'pointer' } }, this.div);
			this.num_span = dojo.create('span', { innerHTML: '1', style: { cursor: 'default' } }, this.div);
			dojo.create('span', { innerHTML: ' of ' + results.hits.length + ' hit' + (results.hits.length != 1 ? 's ' : ' '), style: { cursor: 'default', marginRight: 5 } }, this.div);
			dojo.create('span', { className: 'glyphicon glyphicon-chevron-right', onclick: dojo.hitch(this, function() { if (this.hit < this.results.hits.length - 1) this.go_to(this.hit + 1) }), style: { cursor: 'pointer' } }, this.div);
			dojo.create('span', { className: 'glyphicon glyphicon-step-forward', onclick: dojo.hitch(this, function() { this.go_to(this.results.hits.length - 1) }), style: { cursor: 'pointer' } }, this.div);
			browser.subscribe('/jbrowse/v1/v/tracks/hide', function(configs) {
				for (var i=0; i<configs.length; i++)
					if (configs[i].coge.type == 'search' && configs[i].coge.id == search_id) {
						dojo.destroy(dojo.byId('nav_' + search_id));
						return;
					}
			});
		},
		go_to: function(index) {
			this.hit = index % this.results.hits.length;
			var hit = this.results.hits[this.hit];
			this.num_span.innerHTML = this.hit + 1;
			this.num_span.title = JSON.stringify(hit);
			var chr = this.results.chr_at(this.hit);
			if (chr != this.browser.refSeq.name)
				this.browser.navigateToLocation({
					ref: chr,
					start: hit[0],
					end: hit[1]
				});
			else
				this.browser.view.centerAtBase((hit[0] + hit[1]) / 2, true);
		}
	});

	// ----------------------------------------------------------------

	var SearchResults = declare(null, {
		constructor: function(data, stranded) {
			this.hits = data;
			this.stranded = stranded;
			this.chr = [];
			var current_chr;
			for (var i=0; i<data.length; i++) {
				var index = data[i].indexOf('"', 1);
				var chr = data[i].substring(1, index);
				if (chr != current_chr) {
					if (this.chr.length > 0)
						this.chr[this.chr.length - 1][1] = i;
					this.chr.push([chr, 0]);
					current_chr = chr;
				}
				this.hits[i] = JSON.parse('[' + data[i].substring(index + 2).replace(/,\.,/g, ',"",') + ']');
			}
			this.chr[this.chr.length - 1][1] = data.length;
		},
		boundaries: function(chr) {
			var l = 0;
			for (var i=0; i<this.chr.length; i++) {
				if (chr == this.chr[i][0])
					return [l, l + this.chr[i][1]];
				l += this.chr[i][1];
			}
		},
		chr_at: function(index) {
			var l = 0;
			for (var i=0; i<this.chr.length; i++) {
				l += this.chr[i][1];
				if (l > index)
					return this.chr[i][0];
			}
		},
		get_hits: function(chr, start, end) {
			var b = this.boundaries(chr);
			if (!b)
				return null;
			var i = b[0];
			var j = b[1];
			if (this.hits[i][0] > end)
				return null;
			while (i < j && this.hits[i][1] < start)
				++i;
			if (i == j)
				return null;
			--j;
			while (j >= i && this.hits[j][0] > end)
				--j;
			if (j < i)
				return null;
			return [this.hits, i, j];
		}
	});

	// ----------------------------------------------------------------

return declare( JBrowsePlugin,
{
	constructor: function( args ) {
		coge_plugin = this;
		this.browser = args.browser;
		JBrowse.afterMilestone('initView', function() {
			coge_plugin.create_search_button();
		});
		this.num_merges = 0;
		this.num_searches = 0;
	},

	// ----------------------------------------------------------------

	adjust_nav: function(search_id) {
		var l = dojo.byId('label_search' + search_id);
		if (l) {
			var nav = dojo.byId('nav_' + search_id);
			if (nav) {
				var track = dojo.byId('track_search' + search_id);
				dojo.style(nav, 'left', dojo.style(l, 'left') + 10);
				dojo.style(nav, 'top', dojo.style(track, 'top') + 26);
			}
		}
	},

	// ----------------------------------------------------------------

	build_buttons(ok_onclick, cancel_onclick) {
		var html = '<div class="dijitDialogPaneActionBar"><button data-dojo-type="dijit/form/Button" type="button" onClick="';
		html += ok_onclick;
		html += '">OK</button><button data-dojo-type="dijit/form/Button" type="button" onClick="';
		html += cancel_onclick;
		html += '">Cancel</button></div>';
		return html;
	},

	// ----------------------------------------------------------------

	build_chromosome_select: function(first, onchange) {
		var chr = this.browser.refSeq.name;
		var html = '<select id="coge_ref_seq"';
		if (onchange)
			html += ' onchange="' + onchange + '"';
		html += '>';
		if (first)
			html += '<option>' + first + '</option>';
		this.browser.refSeqOrder.forEach(function(rs) {
			html += '<option';
			if (rs == chr)
				html += ' selected';
			html += '>';
			html += rs;
			html += '</option>';
		});
		html += '</select>';
		return html;
	},

	// ----------------------------------------------------------------

	build_features_checkboxes: function() {
		var html = '';
		var features = this.browser.config.tracks.reduce(function(accum, current) {
			if (current.coge.type && current.coge.type == 'features' && accum.indexOf(current.coge.id) < 0)
				accum.push(current.coge.id);
			return accum;
		}, []);
		features.forEach(function(f) {
			html += '<div><input type="checkbox"';
			if (f == 'gene')
				html += ' checked';
			html += '> <label>' + f + '</label></div>';
		});
		html += '<div><button onClick="coge_plugin.check_all(this.parentNode.parentNode.parentNode,true)">check all</button> <button onClick="coge_plugin.check_all(this.parentNode.parentNode.parentNode,false)">uncheck all</button></div>';
		return html;
	},

	// ----------------------------------------------------------------

	calc_color: function(id) {
		return '#' + ((((id * 1234321) % 0x1000000) | 0x444444) & 0xe7e7e7 ).toString(16);
	},

	// ----------------------------------------------------------------

	check_all: function(element, value) {
		var cb = element.getElementsByTagName('INPUT');
		for (var i=0; i<cb.length; i++)
			cb[i].checked = value;
	},

	// ----------------------------------------------------------------

	confirm: function(title, message, on_confirmed) {
		new ConfirmDialog({
			title: title,
			message: message,
			onHide: function(){this.destroyRecursive()}
		}).show(function(confirmed) {
			 if (confirmed)
				 on_confirmed();
		});
	},

	// ----------------------------------------------------------------

	create_search_button: function() {
		var content = '<div id="coge-search-dialog"><table><tr><td>Name:</td><td><input id="coge_search_text"></td></tr><tr><td>Chromosome:</td><td>';
		content += this.build_chromosome_select('Any');
		content += '</td></tr><tr><td style="vertical-align:top;">Features:</td><td id="coge_search_for_features">';
		content += this.build_features_checkboxes();
		content += '</td></tr></table>';
		content += this.build_buttons('coge_plugin.search_for_features()', 'coge_plugin._search_dialog.hide()');
		content += '</div>';
		new Button({
			label: 'Find Features',
			onClick: function(event) {
				coge_plugin._search_dialog = new Dialog({
					title: "Search",
					content: content,
					onHide: function() {
						this.destroyRecursive();
						coge_plugin._search_dialog = null;
					}
				});
				coge_plugin._search_dialog.show();
				dojo.stopEvent(event);
			},
		}, dojo.create('button', null, this.browser.navbox));
	},

	// ----------------------------------------------------------------

	dnd_dialog: function(track1, track2) {
		if (track1.config.coge.type != 'experiment') {
			coge_plugin.info('Drag and Drop Error','You can only drag experiment tracks onto other tracks');
			return;
		}
		if (track2.config.coge.type == 'search') {
			coge_plugin.info('Drag and Drop Error','You cannot drop tracks onto search tracks');
			return;
		}
		this._track = track1;
		this._track2 = track2;
		if (track2.config.coge.type == 'merge') {
			var track;
			this.browser.view.tracks.forEach(function(t) {
				if (t.config.key == track2.config.key) {
					track = t;
				}
			});
			track2.config.key += ',' + track1.config.key;
			track2.config.coge.eids.push(track1.config.coge.id);
			track2.config.coge.keys.push(track1.config.key);
			this.browser.getStore(track2.config.store, function(store){
				store.config.query['eids'] += ',' + track1.config.coge.id;
			});
			track.changed();
			return;
		}
		var content = '<div id="coge-search-dialog"><table><tr><td>Action:</td><td><input id="dnd_in" type="radio" name="action" checked> Find where ';
		content += track1.config.key;
		content += ' overlaps ';
		content += track2.config.key;
		content += '<br><input id="dnd_not_in" type="radio" name="action"> Find where ';
		content += track1.config.key;
		content += ' does not overlap ';
		content += track2.config.key;
		content += '<br><input id="dnd_merge" type="radio" name="action"> Merge ';
		content += track1.config.key;
		content += ' and ';
		content += track2.config.key;
		content += '</td></tr><tr><td>Chromosome:</td><td>';
		content += this.build_chromosome_select('Any');
		content += '</td></tr></table>';
		content += this.build_buttons('if($(\'#dnd_in\')[0].checked)coge_plugin.intersection(); else if($(\'#dnd_not_in\')[0].checked)coge_plugin.intersection(true); else coge_plugin.merge();', 'coge_plugin._search_dialog.hide()');
		content += '</div>';
		coge_plugin._search_dialog = new Dialog({
				title: "Combine Tracks",
				content: content,
				onHide: function() {
					this.destroyRecursive();
					coge_plugin._search_dialog = null;
				}
			});
		coge_plugin._search_dialog.show();
	},

	// ----------------------------------------------------------------

	error: function(title, content) {
		if (content.responseText) {
			var error = JSON.parse(content.responseText);
			if (error.error)
				if (error.error.Error)
					content = error.error.Error;
				else
					content = JSON.stringify(error.error);
			else
				content = content.responseText;
		} else if (content.error)
			if (content.error.Error)
				content = content.error.Error;
			else
				content = JSON.stringify(content.error);
		this.info(title, content);
	},

	// ----------------------------------------------------------------

	export_dialog: function(track) {
		this._track = track;
		var content = '<div id="coge-track-export"><table align="center" style="width:100%"><tr><td>Chromosome:</td><td>';
		content += this.build_chromosome_select('All');
		content += '</td></tr>';
		if (track.config.coge.transform) {
			content += '<tr><td>Transform:</td><td style="white-space:nowrap"><input type="radio" name="transform" checked="checked"> None <input id="transform" type="radio" name="transform"> ';
			content += track.config.coge.transform;
			content += '</td></tr>';
		}
		if (track.config.coge.search) {
			content += '<tr><td>Search:</td><td style="white-space:nowrap"><input type="radio" name="search" checked="checked"> None <input id="search" type="radio" name="search"> ';
			content += coge_plugin.search_to_string(track.config.coge.search, true);
			content += '</td></tr>';
		}
		content += '<tr><td>Method:</td><td style="white-space:nowrap">';
		content += '<input type="radio" name="export_method" checked="checked" onchange="coge_plugin.export_method_changed()"> Download to local computer&nbsp;&nbsp;&nbsp;';
		content += '<input id="to_cyverse" type="radio" name="export_method" onchange="coge_plugin.export_method_changed()"> Save in CyVerse</td></tr>';
		content += '<tr><td colspan="2" id="cyverse"></td></tr><tr><td>Filename:</td><td><input id="export_filename" />';
		content += this._ext(track.config.coge.data_type);
		content += '</td></tr><tr><td></td><td></td></tr></table>';
		content += this.build_buttons('coge_plugin.export_track()', 'coge_plugin._export_dialog.hide()');
		content += '</div>';
		this._export_dialog = new Dialog({
			title: 'Export Track',
			content: content,
			onHide: function() {
				this.destroyRecursive();
				coge_plugin._export_dialog = null;
			},
			style: "width: 700px"
		});
		this._export_dialog.show();
	},

	// ----------------------------------------------------------------

	export_method_changed: function() {
		if (dojo.byId('to_cyverse').checked) {
			dojo.xhrGet({
				url: 'DirSelect.pl',
				load: function(data) {
					var div = $('<div>' + data + '</div>');
					div.appendTo($('#cyverse'));
					$('#fileselect-tab-1').removeClass('small');
					coge.fileSelect.init({
						container: div
					});
					coge.fileSelect.render();
				},
				error: function(data) {
					coge_plugin.error('DirSelect', data);
				}
			});
		} else
			dojo.empty('cyverse');
	},

	// ----------------------------------------------------------------

	export_track: function() {
		var filename = dojo.byId('export_filename').value;
		if (!filename) {
			this.info('Filename required', 'Please enter a filename', dojo.byId('export_filename'));
			return;
		}
		var to_cyverse = dojo.byId('to_cyverse').checked;
		var ext = this._ext(this._track.config.coge.data_type);
		if (to_cyverse && coge.fileSelect.has_file(filename + ext)) {
			this.info('File exists', 'There is already a file in the current directory with the name ' + filename + ext + '. Please enter a different filename.', dojo.byId('export_filename'));
			return;
		}
		var ref_seq = dojo.byId('coge_ref_seq');
		var url = api_base_url + '/experiment/' + this._track.config.coge.id + '/data/' + ref_seq.options[ref_seq.selectedIndex].innerHTML + '?username=' + un + '&filename=' + filename;
		if (dojo.byId('search') && dojo.byId('search').checked)
			url += '&' + this.search_to_params(this._track.config.coge.search, true);
		if (dojo.byId('transform') && dojo.byId('transform').checked)
			url += '&transform=' + this._track.config.coge.transform;
		if (to_cyverse) {
			var d = new BusyDialog({
				title: 'Exporting to CyVerse...',
				content: '<img src="picts/ajax-loader.gif" /><span></span>'
			});
			d.show();
			url += '&irods_path=' + $('#ids_current_path').html();
			dojo.xhrGet({
				url: url,
				load: function(data) {
					if (data.error) {
						d.hideIfVisible();
						coge_plugin.error('DirSelect', data);
					} else {
						dojo.destroy(d.containerNode.firstChild);
						d.containerNode.firstChild.innerText = 'done';
						d.actionBar.firstChild.style.display=''
					}
				},
				error: function(data) {
					d.hideIfVisible();
					coge_plugin.error('DirSelect', data);
				}
			});
		} else
			document.location = url;
		this._export_dialog.hide();
	},

	// ----------------------------------------------------------------

	_ext: function(data_type) {
		return data_type == 4 ? '.gff' : data_type == 3 ? '.sam' : data_type == 2 ? '.vcf' : '.csv';
	},

	// ----------------------------------------------------------------

	features_overlap_search_dialog: function(track, type, api_path) {
		this._track = track;
		var content = '<div id="coge-track-search-dialog"><table><tr><tr><td>Chromosome:</td><td>';
		content += this.build_chromosome_select('Any');
		content += '</td></tr><tr><td style="vertical-align:top;">Features:</td><td id="coge_search_features_overlap">';
		content += this.build_features_checkboxes();
		content += '</td></tr></table>';
		content += this.build_buttons("coge_plugin.search_features_overlap('" + type + "','" + api_path + "')", 'coge_plugin._search_dialog.hide()');
		content += '</div>';
		this._search_dialog = new Dialog({
			title: 'Find ' + type + ' in Features',
			content: content,
			onHide: function() {
				this.destroyRecursive();
				coge_plugin._search_dialog = null;
			}
		});
		this._search_dialog.show();
	},

	// ----------------------------------------------------------------

	get_checked_values: function(id, description, quote) {
		var checkboxes = document.getElementById(id).getElementsByTagName('INPUT');
		var values = [];
		for (var i=0; i<checkboxes.length; i++)
			if (checkboxes[i].checked)
				if (quote)
					values.push("'" + checkboxes[i].nextElementSibling.innerText + "'");
				else
					values.push(checkboxes[i].nextElementSibling.innerText);
		if (!values.length) {
			coge_plugin.error('Search', 'Please select one or more ' + description + ' to search.');
			return null;
		}
		return values.length == checkboxes.length ? 'all' : values.join();
	},

	// ----------------------------------------------------------------

	info: function(title, content, focus) {
		new InfoDialog({
			title: title,
			content: content,
			onHide: function(){this.destroyRecursive(); if(focus)focus.focus();}
		}).show();
	},

	// ----------------------------------------------------------------

	intersection: function(not) {
		var ref_seq = dojo.byId('coge_ref_seq');
		var chr = ref_seq.options[ref_seq.selectedIndex].innerHTML;
		var div = dojo.byId('coge-search-dialog');
		dojo.empty(div);
		div.innerHTML = '<img src="picts/ajax-loader.gif">';
		var search = {type: not ? 'does not overlap' : 'overlaps', chr: chr, other: this._track2.config.key};
		this._track.config.coge.search = search;
		var eid = this._track.config.coge.id;
		var eid2 = this._track2.config.coge.id;
		var url = api_base_url + '/experiment/' + eid + '/intersection/' + eid2 + '/' + chr;
		if (not)
			url += '?not=true';
		dojo.xhrGet({
			url: url,
			handleAs: 'json',
			load: dojo.hitch(this, function(data) {
				if (this._search_dialog)
					this._search_dialog.hide();
				if (data.error) {
					coge_plugin.error('Search', data);
					return;
				}
				if (data.length == 0) {
					coge_plugin.error('Search', 'no hits');
					return;
				}
				coge_plugin.new_search_track(this._track, data);
			}),
			error: dojo.hitch(this, function(data) {
				if (this._search_dialog)
					this._search_dialog.hide();
				coge_plugin.error('Search', data);
			})
		});
	},

	// ----------------------------------------------------------------

	merge: function() {
		var ref_seq = dojo.byId('coge_ref_seq');
		var chr = ref_seq.options[ref_seq.selectedIndex].innerHTML;
		var div = dojo.byId('coge-search-dialog');
		dojo.empty(div);
		div.innerHTML = '<img src="picts/ajax-loader.gif">';
		var browser = this.browser;
		var config = this._track.config;
		var eid = config.coge.id;
		var eid2 = this._track2.config.coge.id;
		var eids = [eid, eid2];
		var keys = [config.key, this._track2.config.key];
		var d = new Deferred();
		var store_config = {
			browser: browser,
			config: config,
			refSeq: browser.refSeq,
			type: 'JBrowse/Store/SeqFeature/REST',
			baseUrl: api_base_url + '/experiment/' + eid,
			query: { 'eids': eid2 }
		};
		var store_name = browser.addStoreConfig(undefined, store_config);
		store_config.name = store_name;
		browser.getStore(store_name, function(store) {
           d.resolve(true);
       	});
       	d.promise.then(function() {
			config = dojo.clone(config);
			config.baseUrl = api_base_url + '/experiment/' + eid;
			config.query = { 'eids': eid2 };
			var merge_id = ++coge_plugin.num_merges;
			config.key = 'Merge ' + merge_id;
			config.track = 'merge' + merge_id;
			config.label = 'merge' + merge_id;
			config.store = store_name;
			config.coge.id = merge_id;
			config.coge.eids = eids;
			config.coge.keys = keys;
			config.coge.type = 'merge';
			browser.publish('/jbrowse/v1/v/tracks/new', [config]);
			browser.publish('/jbrowse/v1/v/tracks/show', [config]);
			dojo.place(dojo.byId('track_merge' + merge_id), dojo.byId('track_experiment' + eid), 'after');
			browser.view.updateTrackList();
			if (coge_plugin._search_dialog)
				coge_plugin._search_dialog.hide();
		});
	},

	// ----------------------------------------------------------------

	natural_sort: function(a, b) {
	    var re = /(^-?[0-9]+(\.?[0-9]*)[df]?e?[0-9]?$|^0x[0-9a-f]+$|[0-9]+)/gi,
	        sre = /(^[ ]*|[ ]*$)/g,
	        dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
	        hre = /^0x[0-9a-f]+$/i,
	        ore = /^0/,
	        i = function(s) { return (''+s).toLowerCase() || ''+s },
	        // convert all to strings strip whitespace
	        x = i(a).replace(sre, '') || '',
	        y = i(b).replace(sre, '') || '',
	        // chunk/tokenize
	        xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
	        yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
	        // numeric, hex or date detection
	        xD = parseInt(x.match(hre)) || (xN.length != 1 && x.match(dre) && Date.parse(x)),
	        yD = parseInt(y.match(hre)) || xD && y.match(dre) && Date.parse(y) || null,
	        oFxNcL, oFyNcL;
	    // first try and sort Hex codes or Dates
	    if (yD)
	        if ( xD < yD ) return -1;
	        else if ( xD > yD ) return 1;
	    // natural sorting through split numeric strings and default strings
	    for(var cLoc=0, numS=Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
	        // find floats not starting with '0', string or 0 if not defined (Clint Priest)
	        oFxNcL = !(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc]) || xN[cLoc] || 0;
	        oFyNcL = !(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc]) || yN[cLoc] || 0;
	        // handle numeric vs string comparison - number < string - (Kyle Adams)
	        if (isNaN(oFxNcL) !== isNaN(oFyNcL)) { return (isNaN(oFxNcL)) ? 1 : -1; }
	        // rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
	        else if (typeof oFxNcL !== typeof oFyNcL) {
	            oFxNcL += '';
	            oFyNcL += '';
	        }
	        if (oFxNcL < oFyNcL) return -1;
	        if (oFxNcL > oFyNcL) return 1;
	    }
	    return 0;
	},

	// ----------------------------------------------------------------

	new_search_track: function(track, data) {
		var browser = this.browser;
		var config = track.config;
		var eid = config.coge.id;
		var results = new SearchResults(data);
        var d = new Deferred();
		var store_config = {
			browser: browser,
			config: config,
			refSeq: browser.refSeq,
			results: results,
			type: 'CoGe/Store/SeqFeature/Search'
		};
		var store_name = browser.addStoreConfig(undefined, store_config);
		store_config.name = store_name;
		browser.getStore(store_name, function(store) {
           d.resolve(true);
       	});
       	d.promise.then(function() {
       		var search_id = ++coge_plugin.num_searches;
			config = dojo.clone(config);
			config.key = 'Search: ' + config.key + ' (' + coge_plugin.search_to_string(track.config.coge.search) + ')';
			config.track = 'search' + search_id;
			config.label = 'search' + search_id;
			config.original_store = config.store;
			config.store = store_name;
			config.coge.eid = config.coge.id;
			config.coge.id = search_id
			config.coge.type = 'search';
			browser.publish('/jbrowse/v1/v/tracks/new', [config]);
			browser.publish('/jbrowse/v1/v/tracks/show', [config]);
			dojo.place(dojo.byId('track_search' + search_id), dojo.byId('track_experiment' + eid), 'after');
			browser.view.updateTrackList();
			new SearchNav(search_id, results, browser).go_to(0);
		});
	},

	// ----------------------------------------------------------------

	prompt: function(title, prompt, on_ok) {
		new PromptDialog({
			title: title,
			content: prompt + ' <input id="prompt_value" />',
			onHide: function(){this.destroyRecursive()}
		}).show(on_ok);	
	},

	// ----------------------------------------------------------------

	save_as_experiment: function() {
		var browser = this.browser;
		var name = dojo.byId('experiment_name').value;
		if (!name) {
			this.info('Name required', 'Please enter a name', dojo.byId('experiment_name'));
			return;
		}
		var notebooks = [];
		this._track.config.coge.notebooks.forEach(function(notebook) {
			if (notebook != 0 && dojo.byId('add to ' + notebook) && dojo.byId('add to ' + notebook).checked)
				notebooks.push(notebook);
		});

	    var config = this._track.config;
		var to_marker = dojo.byId('to_marker').checked;

		this._save_as_dialog.hide();
		coge.progress.init({
			title: "Creating Experiment",
            onSuccess: function(results) {
            	var id;
            	for (var i=0; i<results.length; i++)
            		if (results[i].type == 'experiment') {
            			id = results[i].id;
            			break;
            		}
		        var d = new Deferred();
				var store_config = {
					baseUrl: api_base_url + '/experiment/' + id,
					browser: browser,
					refSeq: browser.refSeq,
					type: 'JBrowse/Store/SeqFeature/REST'
				};
				var store_name = browser.addStoreConfig(undefined, store_config);
				store_config.name = store_name;
				browser.getStore(store_name, function(store) {
		           d.resolve(true);
		       	});
		       	d.promise.then(function() {
					var new_config = dojo.clone(config);
					new_config.key = '&reg; ' + name;
					new_config.track = 'experiment' + id;
					new_config.label = 'experiment' + id;
					new_config.store = store_name;
					new_config.baseUrl = new_config.baseUrl.replace(config.coge.eid, id);
					if (new_config.histograms && new_config.histograms.baseUrl)
						new_config.histograms.baseUrl = new_config.histograms.baseUrl.replace(config.coge.eid, id);
					new_config.coge.onClick = new_config.coge.onClick.replace(config.coge.eid, id);
					new_config.coge.id = id;
					new_config.coge.name = name;
					new_config.coge.type = 'experiment';
					if (to_marker) {
						new_config.type = 'CoGe/View/Track/Markers';
						new_config.coge.data_type = 4;
					}
					new_config.coge.annotations = 'original experiment name:' + config.coge.name + '\noriginal experiment id:' + config.coge.eid + '\nsearch:' + search + '\nsearch user:' + un;
					if (config.coge.transform)
						new_config.coge.annotations += '\ntransform:' + config.coge.transform;
					if (new_config.coge.data_type == 1 || new_config.coge.data_type == 4)
						new_config.style.featureCss = new_config.style.histCss = 'background-color: ' + coge_plugin.calc_color(id);
					coge_plugin.browser.publish('/jbrowse/v1/v/tracks/new', [new_config]);
					notebooks.forEach(function(notebook) {
						coge_track_list.add_to_notebook([new_config], notebook, true);
					});
					coge_plugin.browser.view.updateTrackList();
					setTimeout(function(){coge_plugin.browser.publish('/jbrowse/v1/v/tracks/show', [new_config]);}, 100);
				});
            }
        });
        coge.progress.begin();
		var load_id = this.unique_id(32);
	    newLoad = true;
	    
		var ref_seq = dojo.byId('coge_ref_seq');
		var search = this.search_to_string(config.coge.search);
		var description = 'Results from search: ' + search;
		var url = api_base_url + '/experiment/' + config.coge.eid + '/data/' + ref_seq.options[ref_seq.selectedIndex].innerHTML + '?username=' + un + '&load_id=' + load_id;
		url += '&' + this.search_to_params(config.coge.search, true);
		var annotions = [
			{
				type: 'created',
				text: (new Date()).toString()
			},
			{
				type: 'original experiment name',
				text: config.coge.name
			},
			{
				type: 'original experiment id',
				text: config.coge.eid
			},
			{
				type: 'search',
				text: search
			},
			{
				type: 'search user',
				text: un
			}
		];
		if (config.coge.transform) {
			url += '&transform=' + config.coge.transform;
			description += ', transform: ' + config.coge.transform;
			annotions.push({ type: 'transform', text: config.coge.transform });
		}
		var ext = this._ext(config.coge.data_type);
		if (to_marker) {
			url += '&gap_max=' + dojo.byId('gap_max').value;
			ext = '.gff';
		}
		dojo.xhrGet({
			url: url,
			load: function(data) {
				if (data.error) {
					coge_plugin.error('Save Results', data);
				} else {
					var request = {
						type: 'load_experiment',
						requester: {
							page: 'jbrowse',
							user_name: un
						},
						parameters: {
							additional_metadata: annotions,
							genome_id: gid,
							load_id: load_id,
							metadata: {
								description: description,
								name: name,
								restricted: true,
								tags: ['search results'],
								version: '1'
							},
							source_data: [{
								file_type: ext.substr(1),
								path: 'upload/search_results' + (ext == '.sam' ? '.bam' : ext),
								type: 'file'
							}]
						}
					};		
				    coge.services.submit_job(request) 
				    	.done(function(response) {
				    		if (!response) {
				    			coge.progress.failed("Error: empty response from server");
				    			return;
				    		}
				    		else if (!response.success || !response.id) {
				    			coge.progress.failed("Error: failed to start workflow", response.error);
				    			return;
				    		}
				            coge.progress.update(response.id, response.site_url);
					    })
					    .fail(function(jqXHR, textStatus, errorThrown) {
					    	coge.progress.failed("Couldn't talk to the server: " + textStatus + ': ' + errorThrown);
					    });
				}
			},
			error: function(data) {
				coge_plugin.error('Save Results', data);
			}
		});
	},

	// ----------------------------------------------------------------

	save_as_experiment_dialog: function(track) {
		if (un == 'public') {
			this.info('Login Required', 'Please log in to CoGe before creating experiments');
			return;
		}
		this._track = track;
		var content = '<div id="coge-track-search-dialog"><table><tr><tr><td>Chromosome:</td><td>';
		content += this.build_chromosome_select('All');
		content += '</td></tr>';
		if (track.config.coge.transform) {
			content += '<tr><td>Transform:</td><td style="white-space:nowrap"><input type="radio" name="transform" checked="checked"> None <input id="transform" type="radio" name="transform"> ';
			content += track.config.coge.transform;
			content += '</td></tr>';
		}
		content += '<tr><td>Name:</td><td><input id="experiment_name" /></td></tr>';
		track.config.coge.notebooks.sort(function(a, b) {
			return coge_plugin.natural_sort(dojo.byId('notebook' + a).config.key, dojo.byId('notebook' + b).config.key);
		});
		var first = true;
		track.config.coge.notebooks.forEach(function(notebook) {
			if (notebook != 0 && coge_track_list.notebook_is_editable(notebook)) {
				content += '<tr><td>';
				if (first) {
					content += 'Notebook:';
					first = false;
				}
				content += '</td><td style="white-space: nowrap;"><input type="checkbox" id="add to ';
				content += notebook;
				content += '" /> add to notebook ';
				content += dojo.byId('notebook' + notebook).config.key;
				content += '</td></tr>';
			}
		});
		if (track.config.coge.data_type == 1) {
			content += '<tr><td>Experiment Type:</td><td><input type="radio" name="exp_type" checked> Quantitative</td></tr>';
			content += '<tr><td></td><td style="white-space: nowrap;"><input type="radio" name="exp_type" id="to_marker"> Marker - merge adjacent markers within <input id="gap_max" value="100" size="4" /> bp</td></tr>';
		}
		content += '</table>';
		content += this.build_buttons('coge_plugin.save_as_experiment()', 'coge_plugin._save_as_dialog.hide()');
		content += '</div>';
		this._save_as_dialog = new Dialog({
			title: 'Save Results as New Experiment',
			content: content,
			onHide: function() {
				this.destroyRecursive();
				coge_plugin._save_as_dialog = null;
			}
		});
		this._save_as_dialog.show();
	},

	// ----------------------------------------------------------------

	search_features_overlap: function(type, api_path) {
		var types = this.get_checked_values('coge_search_features_overlap', 'feature types', true);
		if (!types)
			return;
		var ref_seq = dojo.byId('coge_ref_seq');
		var chr = ref_seq.options[ref_seq.selectedIndex].innerHTML;
		var div = dojo.byId('coge-track-search-dialog');
		dojo.empty(div);
		div.innerHTML = '<img src="picts/ajax-loader.gif">';
		var search = {type: type, chr: chr, features: types};
		this._track.config.coge.search = search;
		var eid = this._track.config.coge.id;
		var url = api_base_url + '/experiment/' + eid + '/' + api_path + '/' + chr + '?features=' + search.features;
		dojo.xhrGet({
			url: url,
			handleAs: 'json',
			load: dojo.hitch(this, function(data) {
				if (this._search_dialog)
					this._search_dialog.hide();
				if (data.error) {
					coge_plugin.error('Search', data);
					return;
				}
				if (data.length == 0) {
					coge_plugin.error('Search', 'no ' + type + ' found');
					return;
				}
				coge_plugin.new_search_track(this._track, data);
			}),
			error: dojo.hitch(this, function(data) {
				if (this._search_dialog)
					this._search_dialog.hide();
				coge_plugin.error('Search', data);
			})
		});
	},

	// ----------------------------------------------------------------

	search_for_features: function() {
		var types = this.get_checked_values('coge_search_for_features', 'feature types', true);
		if (!types)
			return;

		var name = encodeURIComponent(dojo.byId('coge_search_text').value);
		var url = api_base_url + '/genome/' + gid + '/features?name=' + name + '&features=' + types;
		var ref_seq = dojo.byId('coge_ref_seq');
		if (ref_seq.selectedIndex > 0)
			url += '&chr=' + ref_seq.options[ref_seq.selectedIndex].innerHTML;

		var div = dojo.byId('coge-search-dialog');
		dojo.empty(div);
		div.innerHTML = '<img src="picts/ajax-loader.gif">';

		dojo.xhrGet({
			url: url,
			handleAs: 'json',
			load: function(data) {
				coge_plugin._search_dialog.hide();
				if (data.error) {
					coge_plugin.error('Search', data);
					return;
				}
				if (data.length == 0) {
					coge_plugin.error('Search', 'no features found');
					return;
				}
				var div = dojo.byId('feature_hits')
				dojo.create('div', { innerHTML: 'Features <span class="glyphicon glyphicon-remove" onclick="dojo.empty(\'feature_hits\');dijit.byId(\'jbrowse\').resize()"></span>' }, div);
				div = dojo.create('div', { 'class': 'feature_hits' }, div);
				data.forEach(function(hit) {
					dojo.create('a', {
						innerHTML: hit.name,
						onclick: dojo.hitch(hit, function() {
							coge_plugin.browser.navigateToLocation(this.location);
							return false;
						})
					}, div);
					dojo.create('br', null, div);
				});
				dijit.byId('jbrowse').resize();
			},
			error: function(data) {
				coge_plugin.error('Search', data);
			}
		})
	},

	// ----------------------------------------------------------------

	search_to_params: function(search, without_chr) {
		var params;
		if (search.type == 'SNPs')
			if (search.snp_type)
				params = 'snp_type=' + search.snp_type;
			else
				params = 'features=' + search.features;
		else if (search.type == 'Alignments')
			params = 'features=' + search.features;
		else if (search.type == 'Markers')
			params = 'features=' + search.features;
		else if (search.type == 'merge')
			params = 'type=merge&eids=' + search.eids.join(',');
		else if (search.type == 'range')
			params = 'type=range&gte=' + search.gte + '&lte=' + search.lte;
		else
			params = 'type=' + search.type;
		if (!without_chr && search.chr && search.chr != 'Any')
			params += '&chr=' + search.chr;
		return params;		
	},

	// ----------------------------------------------------------------

	search_to_string: function(search, without_chr) {
		var string;
		if (search.type == 'Alignments') {
			string = 'Alignments'
			if (search.features != 'all')
				string += ' in ' + search.features;
		} else if (search.type == 'does not overlap')
			string = 'does not overlap ' + search.other;
		else if (search.type == 'Markers') {
			string = 'Markers'
			if (search.features != 'all')
				string += ' in ' + search.features;
		} else if (search.type == 'merge')
			string = 'merge ' + search.keys.join(',');
		else if (search.type == 'overlaps')
			string = 'overlaps ' + search.other;
		else if (search.type == 'SNPs') {
			if (search.snp_type)
				string = search.snp_type;
			else {
				string = 'SNPs';
				if (search.features != 'all')
					string += ' in ' + search.features;
			}
		} else if (search.type == 'range')
			string = 'range: ' + search.gte + ' .. ' + search.lte;
		else
			string = search.type;
		if (!without_chr && search.chr && search.chr != 'Any')
			string += ', chr=' + search.chr;
		return string;
	},

	// ----------------------------------------------------------------

	unique_id: function(len) {
		var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
		var id = [];
		for (var i = 0; i < len; i++)
			id[i] = chars[0 | Math.random()*chars.length];
		return id.join('');
	}
});
});
