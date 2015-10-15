#! /usr/bin/perl -w

# NOTE: this file shares a lot of code with LoadGenome.pl, replicate changes when applicable.

use strict;

use CGI;
use HTML::Template;
use JSON::XS;
use URI::Escape::JavaScript qw(unescape);
#use File::Path;
#use File::Copy;
#use File::Basename;
use File::Spec::Functions qw(catdir catfile);
#use File::Listing qw(parse_dir);
#use File::Slurp;
use LWP::Simple;
use URI;
use Sort::Versions;
use Data::Dumper;

use CoGeX;
use CoGe::Accessory::Web;
use CoGe::Accessory::IRODS;
use CoGe::Accessory::Jex;
use CoGe::Accessory::TDS;
use CoGe::Accessory::Utils;
use CoGe::Core::Genome qw(genomecmp);
use CoGe::Core::Storage qw(get_workflow_paths get_upload_path get_irods_file);

no warnings 'redefine';

use vars qw(
  $CONF $PAGE_TITLE $TEMPDIR $USER $DB $FORM $LINK $EMBED
  %FUNCTION $LOAD_ID $WORKFLOW_ID $JEX
);

$PAGE_TITLE = 'SynMap3D';

$FORM = new CGI;
( $DB, $USER, $CONF, $LINK ) = CoGe::Accessory::Web->init(
    cgi => $FORM,
    page_title => $PAGE_TITLE
);

$JEX = CoGe::Accessory::Jex->new( host => $CONF->{JOBSERVER}, port => $CONF->{JOBPORT} );

# Get workflow_id and load_id for previous load if specified.  Otherwise
# generate a new load_id for data upload.
$WORKFLOW_ID = $FORM->Vars->{'wid'} || $FORM->Vars->{'job_id'}; # wid is new name, job_id is legacy name
$LOAD_ID = ( defined $FORM->Vars->{'load_id'} ? $FORM->Vars->{'load_id'} : get_unique_id() );
# AKB TODO $TEMPDIR = get_upload_path($USER->name, $LOAD_ID);

$EMBED = $FORM->param('embed');

%FUNCTION = (
    dotplot_dots        => \&dotplot_dots,
    merge_three_dots    => \&merge_three_dots,
    send_error_report   => \&send_error_report
);

CoGe::Accessory::Web->dispatch( $FORM, \%FUNCTION, \&generate_html );

sub generate_html {
   
    my $template;
    
    $EMBED = $FORM->param('embed');
    if ($EMBED) {
        $template = HTML::Template->new( filename => $CONF->{TMPLDIR} . 'embedded_page.tmpl' );
    }
    else {
        $template = HTML::Template->new( filename => $CONF->{TMPLDIR} . 'generic_page.tmpl' );
        $template->param( 
            PAGE_TITLE   => $PAGE_TITLE,
            TITLE        => "SynMap 3D",
            PAGE_LINK    => $LINK,
            HOME         => $CONF->{SERVER},
            HELP         => 'SynMap3d',
            WIKI_URL     => $CONF->{WIKI_URL} || '',
			ADJUST_BOX   => 1,
            ADMIN_ONLY   => $USER->is_admin,
            USER         => $USER->display_name || '',
            CAS_URL      => $CONF->{CAS_URL} || ''
        );
        $template->param( LOGON      => 1 ) unless $USER->is_public;
    }

    $template->param( BODY => generate_body() );
    return $template->output;
}

sub generate_body {
    my $template = HTML::Template->new( filename => $CONF->{TMPLDIR} . $PAGE_TITLE . '.tmpl' );
    $template->param( 
            PAGE_NAME => "$PAGE_TITLE.pl",
            API_BASE_URL => 'api/v1/'
    );
    
    # Force login 
    if ( $USER->is_public ) {
        $template->param( LOGIN => 1 );
        return $template->output;
    }
    
    # Set genome IDs if specified
    my $x_gid = $FORM->param('x_gid');
    my $y_gid = $FORM->param('y_gid');
    my $z_gid = $FORM->param('z_gid');
    if ($x_gid) {
        my $genome = $DB->resultset('Genome')->find($x_gid);
        if ($genome && $USER->has_access_to_genome($genome)) { # check permission
            $template->param(
                X_GENOME_NAME => $genome->info,
                X_GENOME_ID   => $genome->id
            );
        }
    }
    if ($y_gid) {
        my $genome = $DB->resultset('Genome')->find($y_gid);
        if ($genome && $USER->has_access_to_genome($genome)) { # check permission
            $template->param(
                Y_GENOME_NAME => $genome->info,
                Y_GENOME_ID   => $genome->id
            );
        }
    }
    if ($z_gid) {
        my $genome = $DB->resultset('Genome')->find($z_gid);
        if ($genome && $USER->has_access_to_genome($genome)) { # check permission
            $template->param(
                Z_GENOME_NAME => $genome->info,
                Z_GENOME_ID   => $genome->id
            );
        }
    }

    # Set options if specified
    my $hide_nosynt = $FORM->param('hide');
    my $min_len = $FORM->param('min_len');
    my $sortby = $FORM->param('sortby');
    my $vr = $FORM->param('vr');
    if ($hide_nosynt) {
	$template->param( HIDE_NOSYNT => $hide_nosynt );
    }
    if ($min_len) {}
    if ($sortby) {}
    if ($vr) {}


    $template->param(
        MAIN          => 1,
        PAGE_TITLE    => $PAGE_TITLE,
        EMBED         => $EMBED,
    	LOAD_ID       => $LOAD_ID,
    	WORKFLOW_ID   => $WORKFLOW_ID,
        API_BASE_URL  => 'api/v1/', #TODO move into config file or module
        HELP_URL      => 'https://genomevolution.org/wiki/index.php/SynMap3d',
        SUPPORT_EMAIL => $CONF->{SUPPORT_EMAIL},
        DEFAULT_TAB              => 0,
        USER                     => $USER->user_name
    );
    $template->param( SPLASH_COOKIE_NAME => $PAGE_TITLE . '_splash_disabled',
                      SPLASH_CONTENTS    => 'This page allows you to compare synteny between three genomes in a 3d environment. A VR mode is available, for those who so desire.' );
    $template->param( ADMIN_AREA => 1 ) if $USER->is_admin;

    return $template->output;
}

sub get_debug_log {
    my %opts         = @_;
    my $workflow_id = $opts{workflow_id};
    return unless $workflow_id;
    #TODO authenticate user access to workflow

    my (undef, $results_path) = get_workflow_paths($USER->name, $workflow_id);
    return unless (-r $results_path);

    my $result_file = catfile($results_path, 'debug.log');
    return unless (-r $result_file);

    my $result = read_file($result_file);
    return $result;
}

sub dotplot_dots {
    my %opts = @_;
    my $genome_id1 = $opts{genome_id1};
    my $genome_id2 = $opts{genome_id2};
    my $ksfile = $opts{ksfile};

    my $DIAGSDIR = $CONF->{DIAGSDIR};
    my $SCRIPTDIR   = $CONF->{SCRIPTDIR};
    my ( $dir1, $dir2 ) = sort ( $genome_id1, $genome_id2 );

    my $cmd = catfile($SCRIPTDIR, 'dotplot_dots.py') . ' ' . $ksfile;
    my %outputs = [catfile($DIAGSDIR, $dir1, $dir2, 'log.json'),
                  catfile($DIAGSDIR, $dir1, $dir2, 'dots.json')];
    my $description = "running dotplot_dots...";

    my $workflow = $JEX->create_workflow( name => "Finding Syntenic Points");
    $workflow->add_job({
        cmd => $cmd,
        outputs => %outputs,
        description => $description,
    });
    my $response = $JEX->submit_workflow($workflow);

    return $response;
}

sub three_dots_merge {
    my %opts = @_;
    return;
}

sub send_error_report {
    my %opts = @_;
    my $load_id = $opts{load_id};
    my $job_id = $opts{job_id};
    unless ($load_id and $job_id) {
        print STDERR "LoadExperiment::send_error_report: missing required params\n";
        return;
    }

    # Get the staging directory
    my ($staging_dir, $result_dir) = get_workflow_paths($USER->name, $job_id);

    my $url = $CONF->{SERVER} . "$PAGE_TITLE.pl?";
    $url .= "job_id=$job_id;" if $job_id;
    $url .= "load_id=$load_id";

    my $email = $CONF->{SUPPORT_EMAIL};

    my $body =
        "Load failed\n\n"
        . 'For user: '
        . $USER->name . ' id='
        . $USER->id . ' '
        . $USER->date . "\n\n"
        . "staging_directory: $staging_dir\n\n"
        . "result_directory: $result_dir\n\n"
        . "tiny link: $url\n\n";

    my $log = get_debug_log(workflow_id => $job_id);
    $body .= $log if $log;

    CoGe::Accessory::Web::send_email(
        from    => $email,
        to      => $email,
        subject => "Load error notification from $PAGE_TITLE",
        body    => $body
    );
}
