/*global document,$,alert,window,JSON */

var concat = Array.prototype.concat;

// Global experiment data
var current_experiment = {};
var options_name;
var final_experiment;
var edit_focus = undefined;

var pt_select;

//AKB - Modified search_genomes to work on multiple genomes.
function search_genomes (search_term) {
	coge.services.search_genomes(search_term, { fast: true })
		.done(function(result) { // success
			if (result && result.genomes) {
				var transformed = result.genomes.map(function(obj) {
					var label = obj.info.replace(/&reg;/g, "\u00ae"); // (R) symbol
					return { label: label, value: obj.id };
				});
				if (edit_focus == 'x') {
					$('#edit_xgenome')
						.autocomplete({source: transformed})
						.autocomplete("search");
				} else if (edit_focus == 'y') {
					$('#edit_ygenome')
						.autocomplete({source: transformed})
						.autocomplete("search");
				} else if (edit_focus == 'z') {
					$('#edit_zgenome')
						.autocomplete({source: transformed})
						.autocomplete("search");
				}				
			}
		})
		.fail(function() { // error
			//TODO
		});
}

function render_template(template, container) {
    container.empty()
    .hide()
    .append(template)
    .show();//.slideDown();
}

function ExperimentDescriptionView(opts) {
    this.experiment = opts.experiment;
    this.metadata = opts.metadata;
    this.x_gid = opts.x_gid;
    this.y_gid = opts.y_gid;
    this.z_gid = opts.z_gid;
    this.onError = opts.onError;
    this.title = "Select Genomes";
    this.initialize();
}

$.extend(ExperimentDescriptionView.prototype, {
    initialize: function() {
        this.el = $($("#genomes-template").html());
        this.edit_xgenome = this.el.find("#edit_xgenome");
		this.edit_ygenome = this.el.find("#edit_ygenome");
		this.edit_zgenome = this.el.find("#edit_zgenome");
        if (this.metadata) {
            //this.el.find('#edit_name').val(this.metadata.name);
            //this.el.find('#edit_description').val(this.metadata.description);
            //this.el.find('#edit_version').val(this.metadata.version);
            //this.edit_source.val(this.metadata.source_name);

            //if (!this.metadata.restricted)
            //    this.el.find('#restricted').removeAttr('checked');

            //this.el.find('#edit_genome').val(this.metadata.genome); AKB REMOVED 9/15
        }
    },

    render: function() {
        var self = this;
        
        var edit_xgenome = this.edit_xgenome;
		var edit_ygenome = this.edit_ygenome;
		var edit_zgenome = this.edit_zgenome;

        edit_xgenome.unbind().change(function() {
            // Reset gid when item has changed
            self.x_gid = undefined;
        });
        edit_ygenome.unbind().change(function() {
            // Reset gid when item has changed
            self.y_gid = undefined;
        });
        edit_zgenome.unbind().change(function() {
            // Reset gid when item has changed
            self.z_gid = undefined;
        });

        edit_xgenome.autocomplete({
            source:[],
            select: function(event, ui) {
                $(this).val(ui.item.label);
                self.x_gid = ui.item.value;
                return false; // Prevent the widget from inserting the value.
            },

            focus: function(event, ui) {
                //$("#edit_genome").val(ui.item.label);
                return false; // Prevent the widget from inserting the value.
            }
        });
        edit_ygenome.autocomplete({
            source:[],
            select: function(event, ui) {
                $(this).val(ui.item.label);
                self.y_gid = ui.item.value;
                return false; // Prevent the widget from inserting the value.
            },

            focus: function(event, ui) {
                //$("#edit_genome").val(ui.item.label);
                return false; // Prevent the widget from inserting the value.
            }
        });
        edit_zgenome.autocomplete({
            source:[],
            select: function(event, ui) {
                $(this).val(ui.item.label);
                self.z_gid = ui.item.value;
                return false; // Prevent the widget from inserting the value.
            },

            focus: function(event, ui) {
                //$("#edit_genome").val(ui.item.label);
                return false; // Prevent the widget from inserting the value.
            }
        });
       
 
        edit_xgenome.keyup(function() {
			edit_focus = 'x';
        	coge.utils.wait_to_search(search_genomes, self.edit_xgenome.get(0));
        });
        edit_xgenome.click(function() {
			edit_focus = 'x';
        	$(this).autocomplete('search');
        });
        edit_ygenome.keyup(function() {
        	edit_focus = 'y';
			coge.utils.wait_to_search(search_genomes, self.edit_ygenome.get(0));
        });
        edit_ygenome.click(function() {
        	edit_focus = 'y';
			$(this).autocomplete('search');
        });
        edit_zgenome.keyup(function() {
        	edit_focus = 'z';
			coge.utils.wait_to_search(search_genomes, self.edit_zgenome.get(0));
        });
        edit_zgenome.click(function() {
        	edit_focus = 'z';
			$(this).autocomplete('search');
        });
    },

    is_valid: function() {
        var xgenome = this.el.find('#edit_xGenome').val();
		var ygenome = this.el.find('#edit_yGenome').val();
		var zgenome = this.el.find('#edit_zGenome').val();
        
		if (!xgenome || xgenome === 'Search' || !this.x_gid) {
        	if (this.onError)
            	this.onError('Please specify an X-axis genome.');
            return false;
        }

		if (!ygenome || ygenome === 'Search' || !this.y_gid) {
        	if (this.onError)
            	this.onError('Please specify a Y-axis genome.');
            return false;
        }

		if (!zgenome || zgenome === 'Search' || !this.z_gid) {
        	if (this.onError)
            	this.onError('Please specify a Z-axis genome.');
            return false;
        }

       $.extend(this.experiment, {
            metadata: {
				xgenome: xgenome,
				ygenome: ygenome,
				zgenome: zgenome
            },
	    
            x_gid: this.x_gid,
	    	y_gid: this.y_gid,
	    	z_gid: this.z_gid
        });
        return true;
    }
});

function GeneralOptionsView(opts) {
    this.data = {};
    this.initialize();
    this.usr_hide = opts.hide;
    this.usr_minLen = opts.minLen;
    this.usr_sort = opts.sortBy;
    this.onError = opts.onError;
}

$.extend(GeneralOptionsView.prototype, {
    initialize: function() {
        this.el = $($("#general-options-template").html());
		this.no_synt = this.el.find("#nosynt");
		this.min_len = this.el.find("#min_length");
		this.sortby = this.el.find("#sortby");
		//TODO: Add function selection from URL
		if (this.usr_hide) {
	    	console.log("SHOULD HIDE");
	    	this.no_synt.prop("checked", true)
        }
    },

    is_valid: function() {
        var no_synt = this.no_synt.is(":checked");
		var min_len = this.min_len.val();
		var sortby = this.sortby.val();
	
		if (min_len < 0) {
	    	if (this.onError)
	    	this.onError('Minimum chromosome length must be greater than 0.')
	    	return false;
		}

		this.data.hide = no_synt;
		this.data.min_len = min_len;
		this.data.sortby = sortby;
		return true;
    },

    get_options: function() {
        return this.data;
    }
});

function AdvancedOptionView() {
    this.data = {};
    this.initialize();
}

$.extend(AdvancedOptionView.prototype, {
    initialize: function() {
	this.el = $($("#advanced-options-template").html());
        this.vr = this.el.find("#vr");
    },

    is_valid: function() {
		var vr = this.vr.is(":checked");
		this.data.vr = vr;
		return true;
    },

    get_options: function() {
		return this.data;
    }
});

function AdminOptionsView() {
    this.data = {};
    this.initialize();
}

$.extend(AdminOptionsView.prototype, {
    initialize: function() {
        this.el = $($("#admin-options-template").html());
    },

    is_valid: function() {
        return true;
    },

    get_options: function() {
        return this.data;
    }
});

function OptionsView(opts) {
    this.experiment = opts.experiment;
    this.admin = opts.admin;
    this.onError = opts.onError;
    this.title = "Options";
    this.initialize();
    this.hide = opts.hide;
}

//AKB - Removed Admin Options (commented out in this extend)
$.extend(OptionsView.prototype, {
    initialize: function() {
        //this.admin_view = new AdminOptionsView();
        this.general_view = new GeneralOptionsView({
			onError: this.onError,
			hide: this.hide
		});
	
		this.advanced_view = new AdvancedOptionView();
    	this.layout_view = new LayoutView({
        	template: "#options-layout-template",
			layout: {
        		"#general-options": this.general_view,
				"#advanced-options": this.advanced_view
        	}
    	});

		//if (this.admin)
		//    this.layout_view.updateLayout({"#admin-options": this.admin_view});

		this.el = this.layout_view.el;
		this.experiment.options = {};
    },

    // Validate and add all options to the experiment
    is_valid: function() {
        if (!this.advanced_view.is_valid() || !this.general_view.is_valid())
            return false;

        var options = $.extend({}, this.general_view.get_options(), this.advanced_view.get_options());

		/*if (this.admin) {
            if (!this.admin_view.is_valid())
                return false;
            $.extend(options, this.admin_view.get_options());
        }*/

        $.extend(this.experiment.options, options);
        return true;
    },

    render: function() {
        // Render the views added to the layout view
        this.layout_view.renderLayout();
    }
});

function getBgColor(slideValue) {
    var colorCodes = ["#f5f5f5", "#dcdcdc", "#c4c4c4", "#ababab", "#939393",
                      "#7a7a7a", "#626262", "#494949", "#313131", "#181818"];
    return colorCodes[slideValue-1];
}

var visVisible = false;
function showVisualizer(data) {
    console.log(data);

    if (visVisible) {
        //Refresh function can go here.
    } else {
        console.log(final_experiment);
        $.getScript( "js/syn3d/syn3d.js", function( data, textStatus, jqxhr ) {
            console.log( "Visualizer loaded." );
            //console.log( data ); // Data returned
            //console.log( textStatus ); // Success
            //console.log( jqxhr.status ); // 200
        });
        $('#analysis').css("display", "");
    }

    $(document).ready( function() {
        /* Halt scrolling when controlling visualization. */
        $('#canvas').hover( function() {
            $("body").css("overflow", "hidden");
        }, function() {
            $("body").css("overflow", "scroll");
        });

        /* Change background color with slider */
        var renderDiv = $("#rendering");
        var bg_slider = $("#bgslider");
        renderDiv.css("background-color", getBgColor(bg_slider.val()));
        bg_slider.change( function() {
            renderDiv.css("background-color", getBgColor(bg_slider.val()));
        });
    });
}

function launch(experiment) {
    var xgid = experiment.x_gid;
    var ygid = experiment.y_gid;
    var zgid = experiment.z_gid;
    final_experiment = experiment;
    final_experiment.links = {};

    function buildOptionsName(exp) {
        var name = '';
        if (exp.options.hide) { name += 'parsed_'; }
        if (exp.options.nim_len > 0) { name += 'min' + exp.options.min_len + '_'; }
        return name;
    }
    options_name = buildOptionsName(final_experiment);

    var fileDir = "/home/asherkhb/repos/coge/web/data/diags/";
    var fileTag = ".CDS-CDS.last.tdd10.cs0.filtered.dag.all.go_D20_g10_A5.aligncoords.Dm0.ma1.gcoords.ks";
    
    var xy_request = {
        type: 'synmap',
        requester: {
		    page:      PAGE_NAME,
		    user_name: USER_NAME
	    },
        parameters: {
            genome_id1: xgid,
            genome_id2: ygid,
            ks_type: "kn_ks"
        }
    };
    var xz_request = {
    	type: 'synmap',
        requester: {
		    page:      PAGE_NAME,
		    user_name: USER_NAME
	    },
		parameters: {
			genome_id1: xgid,
			genome_id2: zgid,
			ks_type: 'kn_ks'
		}
    };
    var yz_request = {
    	type: 'synmap',
        requester: {
		    page:      PAGE_NAME,
		    user_name: USER_NAME
	    },
		parameters: {
			genome_id1: ygid,
			genome_id2: zgid,
			ks_type: 'kn_ks'
		}
    };
  
    function buildLink(id1, id2) {
        var link = '';
        if (id1 <= id2) {
            link = fileDir + id1 + '/' + id2 + '/' + id1 + '_' + id2 + fileTag;
        }
        else {
            link = fileDir + id2 + '/' + id1 + '/' + id2 + '_' + id1 + fileTag;
        }
        return link;
    }

    // Compute XY Comparison
    // onSuccess: Launch XZ Comparison
    function makeXY() {
        coge.progress.init({title: "Running SynMap Analysis 1/3",
                            onSuccess: function(results) {
                                coge.progress.end();
                                final_experiment.links.xy = buildLink(xgid, ygid);
                                makeXZ();
                            } 
                           });
        coge.progress.begin();
        
        coge.services.submit_job(xy_request)
            .done(function(response) {
                if (!response) {
                    coge.progress.failed("Error: empty response from server");
                    return;
                }
                else if (!response.success || !response.id) {
                    coge.progress.failed("Error: failed to start workflow", response.error);
                    return;
                }
                //Start status update
                window.history.pushState({}, "Title", "SynMap3D.pl" + "?wid=" + response.id); // Add workflow id to URL
                coge.progress.update(response.id);
                //coge.progress.update(response.id, response.site_url);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                coge.progress.failed("Couldn't talk to the server: " + textStatus + ': ' + errorThrown);
            })
    }
    
    // Compute XZ Comparison
    // onSuccess: Launch YZ Comparison
    function makeXZ() { 
        coge.progress.init({title: "Running SynMap Analysis 2/3",
                            onSuccess: function(results) {
                                coge.progress.end();
                                final_experiment.links.xz = buildLink(xgid, zgid);
                                makeYZ();
                            } 
                           });
        coge.progress.begin();
        
        coge.services.submit_job(xz_request)
            .done(function(response) {
                if (!response) {
                    coge.progress.failed("Error: empty response from server");
                    return;
                }
                else if (!response.success || !response.id) {
                    coge.progress.failed("Error: failed to start workflow", response.error);
                    return;
                }

                //Start status update
                window.history.pushState({}, "Title", "SynMap3D.pl" + "?wid=" + response.id); // Add workflow id to URL
                coge.progress.update(response.id);
                //coge.progress.update(response.id, response.site_url);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                coge.progress.failed("Couldn't talk to the server: " + textStatus + ': ' + errorThrown);
            })
    }

    // Compute YZ Comparison
    // onSuccess: Analyses are complete 
    function makeYZ() {
        coge.progress.init({title: "Running SynMap Analysis 3/3",
                            onSuccess: function(results) {
                                coge.progress.end();
                                final_experiment.links.yz = buildLink(ygid, zgid);
                                runDotplotDots();
                            } 
                           });
        coge.progress.begin();
        
        coge.services.submit_job(yz_request)
            .done(function(response) {
                if (!response) {
                    coge.progress.failed("Error: empty response from server");
                    return;
                }
                else if (!response.success || !response.id) {
                    coge.progress.failed("Error: failed to start workflow", response.error);
                    return;
                }

                //Start status update
                window.history.pushState({}, "Title", "SynMap3D.pl" + "?wid=" + response.id); // Add workflow id to URL
                coge.progress.update(response.id);
                //coge.progress.update(response.id, response.site_url);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                coge.progress.failed("Couldn't talk to the server: " + textStatus + ': ' + errorThrown);
            })
    }

    function runDotplotDots() {
        coge.progress.init({title: "Finding Syntenic Points",
                            onSuccess: function(results) {
                                showVisualizer(final_experiment);
                            }
                           });
        coge.progress.begin();

        $.ajax({
                dataType: "json",
                data: {
                    fname: "dotplot_dots",
                    genome_idX: xgid.toString(),
                    genome_idY: ygid.toString(),
                    genome_idZ: zgid.toString(),
                    ksfile_xy: final_experiment.links.xy,
                    ksfile_xz: final_experiment.links.xz,
                    ksfile_yz: final_experiment.links.yz,
                    option_name: options_name,
                    hide: experiment.options.hide,
                    min_len: experiment.options.min_len
                }
            })
            .done(function (response) {
                if (!response) {
                    coge.progress.failed("Error: empty response from server");
                    return;
                }
                else if (!response.success || !response.id) {
                    coge.progress.failed("Error: failed to start workflow", response.error);
                    return;
                }

                //Start status update
                window.history.pushState({}, "Title", "SynMap3D.pl" + "?wid=" + response.id); // Add workflow id to URL
                coge.progress.update(response.id);
                //coge.progress.update(response.id, response.site_url); TODO: Add tiny link (see SynMap.pm for example)

                final_experiment.links.xy_json = response.xy_json;
                final_experiment.links.xz_json = response.xz_json;
                final_experiment.links.yz_json = response.yz_json;
                final_experiment.links.merge = response.merge_json;
                final_experiment.links.histo = response.histo_json;
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                coge.progress.failed("Couldn't talk to the server: " + textStatus + ': ' + errorThrown);
            })

    }

    // Start Comparisons
    makeXY();
}

function reset_launch() { //AKB - Renamed from reset_load()
    window.history.pushState({}, "Title", PAGE_NAME);

    // Reset the wizard and set description step
    initialize_wizard({
        admin: IS_ADMIN,
        metadata: current_experiment.metadata,
	x_gid: current_experiment.x_gid,
	y_gid: current_experiment.y_gid,
	z_gid: current_experiment.z_gid
    });

    $('#wizard-container').hide().fadeIn();
}

function initialize_wizard(opts) {
    current_experiment = {};
    var root = $("#wizard-container");
    var wizard = new Wizard({ 
    	onCompleted: launch, //AKB, changed from 'load' 
    	data: current_experiment, 
    	helpUrl: opts.helpUrl 
    });

    wizard.addStep(new ExperimentDescriptionView({
        experiment: current_experiment,
        metadata: opts.metadata,
        x_gid: opts.x_gid,
        y_gid: opts.y_gid,
        z_gid: opts.z_gid,
        onError: wizard.error_help.bind(wizard)
    }));

    wizard.addStep(new OptionsView({
		experiment: current_experiment,
		hide: opts.hide,
		minLen: opts.minLen,
		sortBy: opts.sortBy,
		vr: opts.vr, 
		admin: opts.admin, 
		onError: wizard.error_help.bind(wizard) 
    }));

    wizard.addStep(new ConfirmationView(current_experiment));

    // Render all the wizard sub views
    wizard.render();

    // Add the wizard to the document
    root.html(wizard.el);
    return wizard;
}
