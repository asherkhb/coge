#! /usr/bin/perl -w

use strict;
use CGI;

use JSON::XS;
use HTML::Template;
use Digest::MD5 qw(md5_base64);
use Sort::Versions;
use List::Util qw(first);
use DBIxProfiler;
use URI::Escape::JavaScript qw(escape unescape);
use Data::Dumper;
use File::Path;
use File::stat;
use CoGe::Accessory::LogUser;
use CoGe::Accessory::Web;
use CoGeX;
use CoGeX::ResultSet::Experiment;
use CoGeX::ResultSet::Genome;
use CoGeX::ResultSet::Feature;
use Benchmark;
no warnings 'redefine';

use vars qw($P $DBNAME $DBHOST $DBPORT $DBUSER $DBPASS $connstr $PAGE_TITLE
  $TEMPDIR $USER $DATE $BASEFILE $coge $cogeweb %FUNCTION
  $COOKIE_NAME $FORM $URL $COGEDIR $TEMPDIR $TEMPURL %ITEM_TYPE
  $MAX_SEARCH_RESULTS);
$P = CoGe::Accessory::Web::get_defaults( $ENV{HOME} . 'coge.conf' );

$DATE = sprintf(
	"%04d-%02d-%02d %02d:%02d:%02d",
	sub { ( $_[5] + 1900, $_[4] + 1, $_[3] ), $_[2], $_[1], $_[0] }->(localtime)
);

$PAGE_TITLE = 'User';

$FORM = new CGI;

$DBNAME  = $P->{DBNAME};
$DBHOST  = $P->{DBHOST};
$DBPORT  = $P->{DBPORT};
$DBUSER  = $P->{DBUSER};
$DBPASS  = $P->{DBPASS};
$connstr = "dbi:mysql:dbname=" . $DBNAME . ";host=" . $DBHOST . ";port=" . $DBPORT;
$coge = CoGeX->connect( $connstr, $DBUSER, $DBPASS );
#$coge->storage->debugobj(new DBIxProfiler());
#$coge->storage->debug(1);

$COOKIE_NAME = $P->{COOKIE_NAME};
$URL         = $P->{URL};
$COGEDIR     = $P->{COGEDIR};
$TEMPDIR     = $P->{TEMPDIR} . "PAGE_TITLE/";
mkpath( $TEMPDIR, 0, 0777 ) unless -d $TEMPDIR;
$TEMPURL = $P->{TEMPURL} . "PAGE_TITLE/";

my ($cas_ticket) = $FORM->param('ticket');
$USER = undef;
($USER) = CoGe::Accessory::Web->login_cas( cookie_name => $COOKIE_NAME, ticket => $cas_ticket, coge => $coge, this_url => $FORM->url() ) if ($cas_ticket);
($USER) = CoGe::Accessory::LogUser->get_user( cookie_name => $COOKIE_NAME, coge => $coge ) unless $USER;
my $link = "http://" . $ENV{SERVER_NAME} . $ENV{REQUEST_URI};
$link = CoGe::Accessory::Web::get_tiny_link( db => $coge, user_id => $USER->id, page => "$PAGE_TITLE.pl", url => $link, disable_logging => 1 );

%FUNCTION = (
	gen_html				=> \&gen_html,
	get_logs				=> \&get_logs,
	upload_image_file		=> \&upload_image_file,
	get_item_info			=> \&get_item_info,
	delete_items			=> \&delete_items,
	undelete_items			=> \&undelete_items,
	get_contents			=> \&get_contents,
	search_notebooks		=> \&search_notebooks,
	add_items_to_notebook	=> \&add_items_to_notebook,
	get_share_dialog		=> \&get_share_dialog,
	search_share			=> \&search_share,
	add_items_to_user_or_group 		=> \&add_items_to_user_or_group,
	remove_items_from_user_or_group	=> \&remove_items_from_user_or_group,
	send_items_to					=> \&send_items_to,
	create_new_group		=> \&create_new_group,
	create_new_notebook		=> \&create_new_notebook,
);

# debug for fileupload:
# print STDERR $ENV{'REQUEST_METHOD'} . "\n" . $FORM->url . "\n" . Dumper($FORM->Vars) . "\n";	# debug
# print "data begin\n" . $FORM->param('POSTDATA') . "\ndata end\n" if ($FORM->param('POSTDATA'));

$MAX_SEARCH_RESULTS = 100;

%ITEM_TYPE = ( # content/toc types 		#FIXME use CoGeX::get_child_types
	all 		=> 100,
	shared 		=> 101, #FIXME not used
	trash 		=> 102,
	user 		=> 103,
	group 		=> 104,
	notebook 	=> 1, # note: should match child_type value for the list_connector table
	genome 		=> 2, # note: should match child_type value for the list_connector table
	experiment 	=> 3  # note: should match child_type value for the list_connector table
);


dispatch();

sub dispatch {
	my %args  = $FORM->Vars;
	my $fname = $args{'fname'};
	if ($fname) {
		die if not defined $FUNCTION{$fname};
		#print STDERR Dumper \%args;
		if ( $args{args} ) {
			my @args_list = split( /,/, $args{args} );
			print $FORM->header, $FUNCTION{$fname}->(@args_list);
		}
		else {
			print $FORM->header, $FUNCTION{$fname}->(%args);
		}
	}
	else {
		print $FORM->header, gen_html();
	}
}

sub gen_html {
	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . 'generic_page.tmpl' );
	$template->param( HELP       => "/wiki/index.php?title=$PAGE_TITLE" );
	my $name = $USER->user_name;
	$name = $USER->first_name if $USER->first_name;
	$name .= " " . $USER->last_name if $USER->first_name && $USER->last_name;
	$template->param( USER       => $name );
	#$template->param( TITLE      => 'User Profile' );
	$template->param( PAGE_TITLE => 'User Profile' );
	$template->param( LOGO_PNG   => "$PAGE_TITLE-logo.png" );
	$template->param( LOGON      => 1 ) unless $USER->user_name eq "public";
	$template->param( DATE       => $DATE );
	$template->param( BODY       => gen_body() );
	$template->param( ADJUST_BOX => 1 );

	return $template->output;
}

sub gen_body {
	if ($USER->user_name eq 'public') {
		my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
		$template->param( PAGE_NAME => "$PAGE_TITLE.pl" );
		$template->param( LOGIN     => 1 );
		return $template->output;
	}

	# Other user specified as param, only allow access if collaborator
	# my $user = $USER;
	# my $uid = $FORM->param('uid');
	# if ($uid) {
	# 	return '' if (!$USER->is_admin && !$USER->has_collaborator($uid));
	# 	$user = $coge->resultset('User')->find($uid);
	# }
	# else {
	# 	my $uname = $FORM->param('name');
	# 	if ($uname) {
	# 		my $u = $coge->resultset('User')->find({user_name => $uname});
	# 		return '' if (!$u || (!$USER->is_admin && !$USER->has_collaborator($u)));
	# 		$user = $u;
	# 	}
	# }

	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
	$template->param( PAGE_NAME  => "$PAGE_TITLE.pl" );
	$template->param( MAIN       => 1 );
	$template->param( ADMIN_AREA => 1 ) if $USER->is_admin;

	$template->param( USER_NAME => $USER->user_name );
	$template->param( FULL_NAME => $USER->display_name );
	$template->param( DESCRIPTION => $USER->description );
	$template->param( EMAIL => $USER->email );
	$template->param( USER_IMAGE => ($USER->image_id ? 'image.pl?id=' . $USER->image_id : 'picts/smiley_default.png' ) );

	foreach (keys %ITEM_TYPE) {
		$template->param( 'ITEM_TYPE_' . uc($_) => $ITEM_TYPE{$_} );
	}
	$template->param( LOGS => get_logs() );
	$template->param( TOC => get_toc() );
	$template->param( CONTENTS => get_contents(html_only => 1) );
	$template->param( ROLES => get_roles('reader') );
	$template->param( NOTEBOOK_TYPES => get_notebook_types('mixed') );

	return $template->output;
}

sub get_item_info {
	my %opts = @_;
	my $item_spec = $opts{item_spec};
	return unless $item_spec;
	my ($item_id, $item_type) = $item_spec =~ /content_(\d+)_(\d+)/;
	return unless ($item_id and defined $item_type);
	my $timestamp = $opts{timestamp};
	# print STDERR "get_item_info: $item_id $item_type\n";

	my $html;
	if ($item_type == $ITEM_TYPE{group}) {
		my $group = $coge->resultset('UserGroup')->find($item_id);
		return unless $group;
		return unless ($USER->is_admin or $group->has_member($USER));

		$html .= '<b>Group id' . $group->id . '</b><br>' . 
				 '<b>Name:</b> ' . $group->name . '<br>' . 
				 '<b>Description:</b> ' . $group->description . '<br>' .
				 '<b>Role:</b> ' . $group->role->name . '<br>' .
				 '<b>Members:</b><br>';
		foreach (sort usercmp $group->users) {
			$html .= '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' . $_->display_name . ' (' . $_->user_name . ')' . '<br>';
		}
	}
	elsif ($item_type == $ITEM_TYPE{notebook}) {
		my $notebook = $coge->resultset('List')->find($item_id);
		return unless $notebook;
		return unless ($USER->is_admin or $USER->has_access_to_list($notebook));

		my $group_str = join('<br>', sort map { $_->name } $notebook->groups(exclude_owner=>1));
		$html .= '<b>Notebook id' . $notebook->id . '</b><br>' . 
				 '<b>Name:</b> ' . $notebook->name . '<br>' . 
				 '<b>Description:</b> ' . $notebook->description . '<br>' .
				 '<b>Contents:</b>' .
				 '<div style="padding-left:20px;">' . $notebook->contents_summary_html . '</div>' .
				 '<b>Groups with access:</b><br>' .
				 '<div style="padding-left:20px;">' .
				 ( $group_str ? $group_str : 'None') . '<br>' .
				 '</div>' .
				 '<b>Users with access:</b><br>' .
				 '<div style="padding-left:20px;">';
		if ($notebook->restricted) {
			$html .= join('<br>', sort map { $_->display_name.' ('.$_->user_name.')' } $notebook->users);
		}
		else {
		 	$html .= 'Everyone';
		}
		$html .= '</div>';				 
	}
	elsif ($item_type == $ITEM_TYPE{genome}) {
		my $genome = $coge->resultset('Genome')->find($item_id);
		return unless $genome;
		return unless ($USER->is_admin or $USER->has_access_to_genome($genome));
	
		my $group_str = join('<br>', sort map { $_->name } $genome->groups(exclude_owner=>1));
		$html .= '<b>Genome id' . $genome->id . '</b><br>' . 
				 '<b>Organism: </b>' . $genome->organism->name . '<br>' .
				 '<b>Name:</b> ' . $genome->name . '<br>' . 
				 '<b>Description:</b> ' . $genome->description . '<br>' .
				 '<b>Version:</b> ' . $genome->version . '<br>' .
				 '<b>Type:</b> ' . ($genome->type ? $genome->type->name : '') . '<br>' .
				 '<b>Source:</b> ' . ($genome->source ? $genome->source->[0]->name : '') . '<br>' .
				 '<b>Groups with access:</b><br>' .
				 '<div style="padding-left:20px;">' .
				 ($group_str ? $group_str : 'None') . '<br>' .
				 '</div>' .
				 '<b>Users with access:</b><br>' .
				 '<div style="padding-left:20px;">';
		if ($genome->restricted) {
			$html .= join('<br>', sort map { $_->display_name.' ('.$_->user_name.')' } $genome->users);
		}
		else {
		 	$html .= 'Everyone';
		}
		$html .= '</div>';
	}
	elsif ($item_type == $ITEM_TYPE{experiment}) {
		my $experiment = $coge->resultset('Experiment')->find($item_id);
		return unless $experiment;
		return unless ($USER->is_admin or $USER->has_access_to_experiment($experiment));
	
		my $group_str = join('<br>', sort map { $_->name } $experiment->groups(exclude_owner=>1));
		$html .= '<b>Experiment id' . $experiment->id . '</b><br>' . 
				 '<b>Name:</b> ' . $experiment->name . '<br>' . 
				 '<b>Description:</b> ' . $experiment->description . '<br>' .
				 '<b>Version:</b> ' . $experiment->version . '<br>' .
				 '<b>Source:</b> ' . ($experiment->source ? $experiment->source->name : '') . '<br>' .
				 '<b>Groups with access:</b><br>' .
				 '<div style="padding-left:20px;">' .
				 ($group_str ? $group_str : 'None') . '<br>' .
				 '</div>' .				 
				 '<b>Users with access:</b><br>' .
				 '<div style="padding-left:20px;">';		 
		if ($experiment->restricted) {
			$html .= join('<br>', sort map { $_->display_name.' ('.$_->user_name.')' } $experiment->users);
		}
		else {
		 	$html .= 'Everyone';
		}
		$html .= '</div>';				 
	}	

	return encode_json({ timestamp => $timestamp, html => $html });
}

sub delete_items {
	my %opts = @_;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);

		# print STDERR "delete $item_id $item_type\n";
		if ($item_type == $ITEM_TYPE{group}) {
			my $group = $coge->resultset('UserGroup')->find($item_id);
			return unless $group;

			if (!$group->locked and ($USER->is_admin or $group->creator_user_id == $USER->id)) {
				$group->delete;
			}
		}
		elsif ($item_type == $ITEM_TYPE{notebook}) {
			my $notebook = $coge->resultset('List')->find($item_id);
			return unless $notebook;

			if (!$notebook->locked and ($USER->is_admin or $USER->is_owner(list => $notebook))) {
				$notebook->delete;
			}
		}
		elsif ($item_type == $ITEM_TYPE{genome}) {
			my $genome = $coge->resultset('Genome')->find($item_id);
			return unless $genome;

			if ($USER->is_admin or $USER->has_access_to_genome($genome)) {
				$genome->deleted(1);
				$genome->update;
			}
		}
		elsif ($item_type == $ITEM_TYPE{experiment}) {
			my $experiment = $coge->resultset('Experiment')->find($item_id);
			return unless $experiment;

			if ($USER->is_admin or $USER->has_access_to_experiment($experiment)) {
				$experiment->deleted(1);
				$experiment->update;
			}
		}		
	}
}

sub undelete_items {
	my %opts = @_;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);

		# print STDERR "undelete $item_id $item_type\n";
		if ($item_type == $ITEM_TYPE{genome}) {
			my $genome = $coge->resultset('Genome')->find($item_id);
			return unless $genome;

			if ($USER->is_admin or $USER->has_access_to_genome($genome)) {
				$genome->deleted(0);
				$genome->update;
			}
		}
		elsif ($item_type == $ITEM_TYPE{experiment}) {
			my $experiment = $coge->resultset('Experiment')->find($item_id);
			return unless $experiment;

			if ($USER->is_admin or $USER->has_access_to_experiment($experiment)) {
				$experiment->deleted(0);
				$experiment->update;
			}
		}		
	}
}

sub get_roles {
	my $selected = shift;

	my $html;
	foreach my $role ( $coge->resultset('Role')->all() ) {
		next if $role->name =~ /admin/i && !$USER->is_admin;
		next if $role->name =~ /owner/i && !$USER->is_admin;
		my $name = $role->name;
		$name .= ": " . $role->description if $role->description;
		#push @roles, { RID => $role->id, NAME => $name, SELECTED => ($role->id == $selected_role_id) };
		$html .= '<option value="' . $role->id . '" ' . ($role->id eq $selected || $role->name =~ /$selected/i ? 'selected': '') . '>' . $role->name . '</option>';
	}
	return $html;
}

sub get_share_dialog {
	my %opts = @_;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	my (%groups, %userconn);
	my $isPublic = 0;
	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);

		print STDERR "get_share $item_id $item_type\n";
		if ($item_type == $ITEM_TYPE{genome}) {
			my $genome = $coge->resultset('Genome')->find($item_id);
			return unless $genome;
			next unless ($USER->is_admin or $USER->has_access_to_genome($genome));
			map { $groups{$_->id} = $_ } $genome->groups;
			map { $userconn{$_->parent_id}  = $_ } $genome->user_connectors;
			$isPublic = 1 if (not $genome->restricted);
		}
		elsif ($item_type == $ITEM_TYPE{experiment}) {
			my $experiment = $coge->resultset('Experiment')->find($item_id);
			return unless $experiment;
			next unless ($USER->is_admin or $USER->has_access_to_experiment($experiment));
			map { $groups{$_->id} = $_ } $experiment->groups;
			map { $userconn{$_->id}  = $_ } $experiment->user_connectors;
			$isPublic = 1 if (not $experiment->restricted);
		}
		elsif ($item_type == $ITEM_TYPE{notebook}) {
			my $notebook = $coge->resultset('List')->find($item_id);
			return unless $notebook;
			next unless ($USER->is_admin or $USER->has_access_to_list($notebook));
			map { $groups{$_->id} = $_ } $notebook->groups;
			map { $userconn{$_->id}  = $_ } $notebook->user_connectors;
			$isPublic = 1 if (not $notebook->restricted);
		}		
	}

	my @user_rows;
	foreach my $conn (values %userconn) {
		if ($conn->parent_type == 5) { #FIXME hardcoded type
			push @user_rows, { 	USER_ITEM => $conn->user->id.':5', #FIXME hardcoded type
						   		USER_FULL_NAME => $conn->user->display_name, 
						   		USER_NAME => $conn->user->name,
						   		USER_ROLE => $conn->role->name,
								USER_DELETE => 1 };
		}
		if ($conn->parent_type == 6) { #FIXME hardcoded type
			my $group = $conn->user_group;
			$groups{$group->id} = $group;
		}
	}

	my @group_rows;
	foreach my $group (sort groupcmp values %groups) {
		if ($group->is_owner) { #FIXME will go away with new user_connector
			my $u = $group->creator;
			push @user_rows, { 	USER_ITEM => $u->id.':5', #FIXME hardcoded type
						  	USER_FULL_NAME => $u->display_name, 
						  	USER_NAME => $u->name,
						   	USER_ROLE => 'Owner'
					};
			next;
		}		

		my @users = map { { GROUP_USER_FULL_NAME => $_->display_name, 
							GROUP_USER_NAME => $_->name } 
						} sort usercmp $group->users;
		push @group_rows, { GROUP_ITEM => $group->id.':6', #FIXME hardcoded type
					   		GROUP_NAME => $group->name, 
					   		GROUP_ROLE => $group->role->name,
					   		GROUP_USER_LOOP => \@users };
	}

	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
	$template->param( SHARE_DIALOG => 1 );
	$template->param( GROUP_LOOP => \@group_rows );
	$template->param( USER_LOOP => [sort {$a->{USER_FULL_NAME} cmp $b->{USER_FULL_NAME}} @user_rows] );
	$template->param( ROLES => get_roles('reader') );

	if ($isPublic) {
		$template->param( ACCESS_MSG => 'Everyone' );
	}

	return $template->output;
}

sub search_share { 
	my %opts = @_;
	return if ($USER->user_name eq 'public');
	my $search_term	= escape($opts{search_term});
	my $timestamp	= $opts{timestamp};
	# print STDERR "search_share $search_term $timestamp\n";
	
	my @results;

	# Perform search
	# $search_term = '%'.$search_term.'%';
	# foreach ($coge->resultset('User')->search_literal(
	# 		"user_name LIKE '$search_term' OR first_name LIKE '$search_term' OR last_name LIKE '$search_term'"))
	foreach ($coge->resultset('User')->all) {
		next unless ($_->user_name =~ /$search_term/i || $_->display_name =~ /$search_term/i);
		push @results, { 'label' => $_->display_name, 'value' => $_->id.':'.$ITEM_TYPE{user} }
	}

	foreach ($coge->resultset('UserGroup')->all) {
		next if ($_->is_owner); #FIXME will go away with new user_connector table
		next unless ($_->name =~ /$search_term/i);
		my $label = $_->name.' ('.$_->role->name.' group)';
		push @results, { 'label' => $label, 'value' => $_->id.':'.$ITEM_TYPE{group} }
	}

	return encode_json({timestamp => $timestamp, items => \@results });
}

sub add_items_to_user_or_group {
	my %opts = @_;
	my $target_item = $opts{target_item};
	return unless $target_item;
	my $role_id = $opts{role_id};
	return unless $role_id;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	# Verify that user has access to each item
	my @verified;
	foreach my $item (@items) {
		my ($item_id, $item_type) = $item =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);

		# print STDERR "add_items_to_user_or_group $item_id $item_type\n";
		if ($item_type == $ITEM_TYPE{genome}) {
			my $genome = $coge->resultset('Genome')->find($item_id);
			return unless $genome;
			next unless ($USER->is_admin or $USER->has_access_to_genome($genome));
			push @verified, $item;
		}
		elsif ($item_type == $ITEM_TYPE{experiment}) {
			my $experiment = $coge->resultset('Experiment')->find($item_id);
			return unless $experiment;
			next unless ($USER->is_admin or $USER->has_access_to_experiment($experiment));
			push @verified, $item;
		}
		elsif ($item_type == $ITEM_TYPE{notebook}) {
			my $notebook = $coge->resultset('List')->find($item_id);
			return unless $notebook;
			next unless ($USER->is_admin or $USER->has_access_to_list($notebook));
			push @verified, $item;
		}
	}

	# Assign each item to user/group
	my ($target_id, $target_type) = $target_item =~ /(\d+)\:(\d+)/;
	next unless ($target_id and $target_type);
	print STDERR "add_items_to_user_or_group $target_id $target_type\n";
	
	#TODO verify that user can use specified role (for admin/owner roles)

	if ($target_type == $ITEM_TYPE{user}) {
		my $user = $coge->resultset('User')->find($target_id);
		return unless $user;

		foreach (@verified) {
			my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
			print STDERR "   user: $item_id $item_type\n";
			my $conn = $coge->resultset('UserConnector')->find_or_create(
				{ parent_id => $target_id,
				  parent_type => 5, # FIXME hardcoded 
				  child_id => $item_id, 
				  child_type => $item_type,
				  role_id => $role_id
				}
			);
			return unless $conn;
		}
	}
	elsif ($target_type == $ITEM_TYPE{group}) {
		my $group = $coge->resultset('UserGroup')->find($target_id);
		return unless $group;

		foreach (@verified) {
			my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
			print STDERR "   group: $item_id $item_type\n";
			my $conn = $coge->resultset('UserConnector')->find_or_create(
				{ parent_id => $target_id, 
				  parent_type => 6, # FIXME hardcoded
				  child_id => $item_id, 
				  child_type => $item_type,
				  role_id => $role_id
				}
			);
			return unless $conn;
		}		
	}

	return get_share_dialog(item_list => $item_list);
}

sub remove_items_from_user_or_group {
	my %opts = @_;
	my $target_item = $opts{target_item};
	return unless $target_item;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	my ($target_id, $target_type) = $target_item =~ /(\d+)\:(\d+)/;
	next unless ($target_id and $target_type);

	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);

		# print STDERR "remove_item_from_user $item_id $item_type\n";
		if ($item_type == $ITEM_TYPE{genome}) {
			my $genome = $coge->resultset('Genome')->find($item_id);
			return unless $genome;
			next unless ($USER->is_admin or $USER->has_access_to_genome($genome));

			my $conn = $coge->resultset('UserConnector')->find(
				{ parent_id => $target_id, 
				  parent_type => $target_type,
				  child_id => $genome->id, 
				  child_type => $ITEM_TYPE{genome}
				}
			);
			return unless $conn;

			$conn->delete;
		}
		elsif ($item_type == $ITEM_TYPE{experiment}) {
			my $experiment = $coge->resultset('Experiment')->find($item_id);
			return unless $experiment;
			next unless ($USER->is_admin or $USER->has_access_to_experiment($experiment));

			my $conn = $coge->resultset('UserConnector')->find(
				{ parent_id => $target_id, 
				  parent_type => $target_type, #FIXME hardcoded
				  child_id => $experiment->id, 
				  child_type => $ITEM_TYPE{experiment}
				}
			);
			return unless $conn;

			$conn->delete;
		}
		elsif ($item_type == $ITEM_TYPE{notebook}) {
			my $notebook = $coge->resultset('List')->find($item_id);
			return unless $notebook;
			next unless ($USER->is_admin or $USER->has_access_to_list($notebook));

			my $conn = $coge->resultset('UserConnector')->find(
				{ parent_id => $target_id, 
				  parent_type => $target_type, #FIXME hardcoded
				  child_id => $notebook->id, 
				  child_type => $ITEM_TYPE{notebook}
				}
			);
			return unless $conn;

			$conn->delete;
		}	
	}

	return get_share_dialog(item_list => $item_list);
}

sub send_items_to {
	my %opts = @_;
	my $page_name = $opts{page_name};
	return unless $page_name;
	my $format = $opts{format};
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;

	my %fields;
	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);
		push @{$fields{$item_type}}, $item_id;
	}

	my $url;
	my $num = 1;
	foreach my $type (keys %fields) {
		my $name;
		if ($type == $ITEM_TYPE{genome}) {
			$name = 'dsgid';
		}
		elsif ($type == $ITEM_TYPE{experiment}) {
			$name = 'eid';
		}
		elsif ($type == $ITEM_TYPE{notebook}) {
			$name = 'nid';
		}

		if ($format == 1) { # numbered
			$url .= join(';', map { $name.($num++).'='.$_ } @{$fields{$type}});
		}
		elsif ($format == 2) { # list
			$url .= $name . '=' . join(',', @{$fields{$type}});
		}
		else {
			$url .= join(';', map { $name.'='.$_ } @{$fields{$type}});
		}
	}

	$url = $page_name.'.pl?'.$url if ($url);

	return $url;
}

sub get_toc {
	my @rows;
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{all}, 
				  TOC_ITEM_INFO => 'My Stuff' };
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{group}, 
				  TOC_ITEM_INFO => 'Groups', 
				  TOC_ITEM_ICON => '<img src="picts/group-icon.png" width="15" height="15"/>', 
				  TOC_ITEM_INDENT => 20 };
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{notebook}, 
				  TOC_ITEM_INFO => 'Notebooks', 
				  TOC_ITEM_ICON => '<img src="picts/notebook-icon.png" width="15" height="15"/>', 
				  TOC_ITEM_INDENT => 20 };
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{genome}, 
				  TOC_ITEM_INFO => 'Genomes', 
				  TOC_ITEM_ICON => '<img src="picts/dna-icon.png" width="15" height="15"/>', 
				  TOC_ITEM_INDENT => 20 };
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{experiment}, 
				  TOC_ITEM_INFO => 'Experiments', 
				  TOC_ITEM_ICON => '<img src="picts/testtube-icon.png" width="15" height="15"/>', 
				  TOC_ITEM_INDENT => 20 };
	# push @rows, { TOC_ITEM_ID => $ITEM_TYPE{shared}, 
	# 			  TOC_ITEM_INFO => 'Shared with me' };
	push @rows, { TOC_ITEM_ID => $ITEM_TYPE{trash}, 
				  TOC_ITEM_INFO => 'Trash' };				  				  
	

	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
	$template->param( DO_TOC => 1 );
	$template->param( TOC_ITEM_LOOP => \@rows );
	return $template->output;	
}

sub get_contents {
	my %opts = @_;
	my $type = $opts{type};
	$type = $ITEM_TYPE{all} unless $type;
	my $timestamp = $opts{timestamp};
	my $html_only = $opts{html_only};

	my $title;
	my @rows;

	if ($type == $ITEM_TYPE{all} or $type == $ITEM_TYPE{group}) {
		$title = 'Groups';
		foreach my $group (sort {$a->name cmp $b->name} $USER->groups) {
			next if ($group->is_owner); # don't show owner groups
			push @rows, { CONTENTS_ITEM_ID => $group->id, 
						  CONTENTS_ITEM_TYPE => $ITEM_TYPE{group}, 
						  CONTENTS_ITEM_INFO => $group->info, 
					  	  CONTENTS_ITEM_ICON => '<img src="picts/group-icon.png" width="15" height="15" style="vertical-align:middle;"/>',
					  	  CONTENTS_ITEM_LINK =>  'GroupView.pl?ugid=' . $group->id };
		}
	}
	if ($type == $ITEM_TYPE{all} or $type == $ITEM_TYPE{notebook}) {
		$title = 'Notebooks';
		foreach my $list (sort listcmp $USER->lists) {
			next if ($list->is_owner); # don't show owner lists
			push @rows, { CONTENTS_ITEM_ID => $list->id, 
						  CONTENTS_ITEM_TYPE => $ITEM_TYPE{notebook}, 
						  CONTENTS_ITEM_INFO => $list->info, 
					  	  CONTENTS_ITEM_ICON => '<img src="picts/notebook-icon.png" width="15" height="15" style="vertical-align:middle;"/>',
					  	  CONTENTS_ITEM_LINK =>  'NotebookView.pl?nid=' . $list->id };
		}
	}	
	if ($type == $ITEM_TYPE{all} or $type == $ITEM_TYPE{genome}) {
		$title = 'Genomes';
		foreach my $genome (sort genomecmp $USER->genomes(include_deleted => 1)) {
			push @rows, { CONTENTS_ITEM_ID => $genome->id, 
						  CONTENTS_ITEM_TYPE => $ITEM_TYPE{genome},
						  CONTENTS_ITEM_DELETED => $genome->deleted,
						  CONTENTS_ITEM_INFO => $genome->info, 
					  	  CONTENTS_ITEM_ICON => '<img src="picts/dna-icon.png" width="15" height="15" style="vertical-align:middle;"/>',
					  	  CONTENTS_ITEM_LINK =>  'GenomeInfo.pl?gid=' . $genome->id };
		}
	}
	if ($type == $ITEM_TYPE{all} or $type == $ITEM_TYPE{experiment}) {
		$title = 'Experiments';
		foreach my $experiment (sort experimentcmp $USER->experiments(include_deleted => 1)) {
			push @rows, { CONTENTS_ITEM_ID => $experiment->id, 
						  CONTENTS_ITEM_TYPE => $ITEM_TYPE{experiment}, 
						  CONTENTS_ITEM_DELETED => $experiment->deleted,
						  CONTENTS_ITEM_INFO => $experiment->info, 
					  	  CONTENTS_ITEM_ICON => '<img src="picts/testtube-icon.png" width="15" height="15" style="vertical-align:middle;"/>',
					  	  CONTENTS_ITEM_LINK =>  'ExperimentView.pl?eid=' . $experiment->id };
		}
	}

	$title = 'My Stuff' if ($type == $ITEM_TYPE{all});

	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
	$template->param( DO_CONTENTS => 1 );
	$template->param( CONTENTS_TITLE => $title );
	$template->param( CONTENTS_ITEM_LOOP => \@rows );
	my $html = $template->output;

	return $html if ($html_only);
	return encode_json({ timestamp => $timestamp, html => $html });
}

sub get_logs {
	return if ($USER->user_name eq "public");

	my %opts = @_;
	my $type = $opts{type};

	my @logs;
	if (!$type or $type eq 'recent') {
		@logs = $coge->resultset('Log')->search( { user_id => $USER->id }, { order_by => { -desc => 'time' } } ); # $user->logs;
		#my @logs = reverse $coge->resultset('Log')->search_literal( 'user_id = ' . $user->id . ' AND time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)' );
	}
	else {
		@logs = $coge->resultset('Log')->search( { user_id => $USER->id, status => 1 }, { order_by => { -desc => 'time' } } );
	}

	my @rows;
	foreach (splice(@logs, 0, 100)) {
		push @rows, { LOG_TIME => $_->time,
					  LOG_PAGE => $_->page,
					  LOG_DESC => $_->description,
					  LOG_LINK => $_->link
					};
	}
	return if (not @rows);

	my $template = HTML::Template->new( filename => $P->{TMPLDIR} . "$PAGE_TITLE.tmpl" );
	$template->param( LOG_TABLE => 1 );
	$template->param( LOG_LOOP => \@rows );
	return $template->output;
}

sub upload_image_file {
	return if ($USER->user_name eq "public");

	my %opts = @_;
	my $image_filename = '' . $FORM->param('input_upload_file');
	my $fh = $FORM->upload('input_upload_file');
	return if (-s $fh > 2*1024*1024); # limit to 2MB

	#TODO delete old image

	# Create the image
	my $image;
	if ($fh) {
		#print STDERR "$image_filename size=" . (-s $fh) . "\n";
		read($fh, my $contents, -s $fh);
		$image = $coge->resultset('Image')->create(
		  {	filename => $image_filename,
			image => $contents
		  }
		);
		return unless $image;

		# Link to user
		$USER->image_id($image->id);
		$USER->update;
		return encode_json({ link => 'image.pl?id=' . $image->id });
	}
	
	return;
}

sub search_notebooks { 
	my %opts = @_;
	return if ($USER->user_name eq 'public');
	my $search_term	= $opts{search_term};
	my $timestamp	= $opts{timestamp};
#	print STDERR "$search_term $timestamp\n";
	
	my @notebooks;
	my $num_results;
	my $group_str = join(',', map { $_->id } $USER->groups);

	# Try to get all items if blank search term
	if (!$search_term) {
		my $sql = "locked=0 AND (restricted=0 OR user_group_id IN ( $group_str ))";
		$num_results = $coge->resultset("List")->count_literal($sql);
		if ($num_results < $MAX_SEARCH_RESULTS) {
			@notebooks = $coge->resultset("List")->search_literal($sql);
		}
	}
	# Perform search
	else {
		# Get public lists and user's private lists	
		$search_term = '%'.$search_term.'%';
		@notebooks = $coge->resultset("List")->search_literal(
			"locked=0 AND (restricted=0 OR user_group_id IN ( $group_str )) \
			 AND (name LIKE '$search_term' OR description LIKE '$search_term')");
		$num_results = @notebooks;
	}
	
	# Limit number of results display
	if ($num_results > $MAX_SEARCH_RESULTS) {
		return encode_json({
					timestamp => $timestamp,
					html => "<option>$num_results matches, please refine your search.</option>"
		});
	}
	
	# Build select items out of results
	my $html;
	foreach my $n (sort listcmp @notebooks) {
		$html .= "<option value='" . $n->id . "'>" . $n->info . "</option><br>\n";	
	}
	$html = "<option disabled='disabled'>No matches</option>" unless $html;
	
	return encode_json({timestamp => $timestamp, html => $html});
}

sub add_items_to_notebook {
	my %opts = @_;
	my $nid  = $opts{nid};
	return unless $nid;
	my $item_list = $opts{item_list};
	my @items = split(',', $item_list);
	return unless @items;
	print STDERR "add_items_to_notebook $nid $item_list\n";

	my $notebook = $coge->resultset('List')->find($nid);
	return unless $notebook;
	return unless $USER->has_access_to_list($notebook);

	foreach (@items) {
		my ($item_id, $item_type) = $_ =~ /content_(\d+)_(\d+)/;
		next unless ($item_id and $item_type);
		next unless ($item_type eq $ITEM_TYPE{notebook} or $item_type eq $ITEM_TYPE{genome} or $item_type eq $ITEM_TYPE{experiment});

		#TODO check access permission on each item

		print STDERR "add_item_to_notebook $item_id $item_type\n";

		my $conn = $coge->resultset('ListConnector')->find_or_create( { parent_id => $nid, child_id => $item_id, child_type => $item_type } );	
		return unless $conn;
	}

	return 1;
}

sub create_new_group {
    my %opts = @_;
	my $name = $opts{name};
	my $desc = $opts{desc};
	my $role_id = $opts{role_id};
	return unless $name && $role_id;

	return if ($USER->user_name eq "public");

    my $role = $coge->resultset('Role')->find($role_id);
    return unless $role;

    my $group = $coge->resultset('UserGroup')->create(
      { creator_user_id => $USER->id,
        name => $name,
        description => $desc,
        role_id => $role->id
      });
    return unless $group;

    my $conn = $coge->resultset('UserGroupConnector')->create( { user_id => $USER->id, user_group_id => $group->id } );
    return unless $conn;

    $coge->resultset('Log')->create( { user_id => $USER->id, page => "$PAGE_TITLE.pl", description => 'create user group id' . $group->id } );

    return 1;
}

sub create_new_notebook {
	my %opts = @_;
	my $name = $opts{name};
	my $desc = $opts{desc};
	my $type_id = $opts{type_id};
	return unless $name && $type_id;
	my $item_list = $opts{item_list}; # optional
    return if ($USER->user_name eq "public");

    # Get owner user group for the new list
    my $owner = $USER->owner_group;
    return unless $owner;

    # Create the new list
    my $list = $coge->resultset('List')->create({ 
    	name => $name,
        description => $desc,
        list_type_id => $type_id,
        user_group_id => $owner->id,
        restricted => 1
    });

	add_items_to_notebook(nid => $list->id, item_list => $item_list) if ($item_list);

    CoGe::Accessory::Web::log_history( db => $coge, user_id => $USER->id, page => "$PAGE_TITLE.pl", description => 'create notebook id' . $list->id );

    return 1;
}

sub get_notebook_types {
	my $selected = shift;
	my $html;
	foreach my $type ( $coge->resultset('ListType')->all() ) {
		next if ($type->name =~ /owner/i); # reserve this type for system-created lists
		my $name = $type->name;# . ($type->description ? ": " . $type->description : '');
		$html .= '<option value="' . $type->id . '" ' . ($type->id eq $selected || $type->name =~ /$selected/i ? 'selected': '') . '>' . $name . '</option>';
	}
	return $html;
}

# FIXME these comparison routines are duplicated elsewhere
sub genomecmp {
	no warnings 'uninitialized'; # disable warnings for undef values in sort
	$a->organism->name cmp $b->organism->name || versioncmp($b->version, $a->version) || $a->type->id <=> $b->type->id || $a->name cmp $b->name || $b->id cmp $a->id
}

sub experimentcmp {
	no warnings 'uninitialized'; # disable warnings for undef values in sort
	versioncmp($b->version, $a->version) || $a->name cmp $b->name || $b->id cmp $a->id
}

sub listcmp {
	no warnings 'uninitialized'; # disable warnings for undef values in sort
	$a->name cmp $b->name
}

sub groupcmp {
	no warnings 'uninitialized'; # disable warnings for undef values in sort
	$a->name cmp $b->name	
}

sub usercmp {
	no warnings 'uninitialized'; # disable warnings for undef values in sort
	$a->display_name cmp $b->display_name
}
