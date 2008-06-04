#! /usr/bin/perl -w
use strict;
use CGI;
use CGI::Carp 'fatalsToBrowser';
use CoGe::Accessory::LogUser;
use HTML::Template;
use Data::Dumper;
use CGI::Ajax;
#use CoGeX;
use Benchmark;
use CoGe::Accessory::Web;
use CoGe::Accessory::genetic_code;
use Statistics::Basic::Mean;

$ENV{PATH} = "/opt/apache2/CoGe/";

use vars qw( $DATE $DEBUG $TEMPDIR $TEMPURL $USER $FORM $coge $connstr);

# set this to 1 to print verbose messages to logs
$DEBUG = 0;
$TEMPDIR = "/opt/apache/CoGe/tmp";
$TEMPURL = "/CoGe/tmp";
$| = 1; # turn off buffering
$DATE = sprintf( "%04d-%02d-%02d %02d:%02d:%02d",
		 sub { ($_[5]+1900, $_[4]+1, $_[3]),$_[2],$_[1],$_[0] }->(localtime));

$FORM = new CGI;
($USER) = CoGe::Accessory::LogUser->get_user();
my $pj = new CGI::Ajax(
		       gen_data=>\&gen_data,
		      );
$pj->JSDEBUG(0);
$pj->DEBUG(0);
print $pj->build_html($FORM, \&gen_html);
#print "Content-Type: text/html\n\n";print gen_html($FORM);
sub gen_html
  {
    my $html;
    unless ($USER && $USER->user_name  !~/public/i)
      {
	$html = login();
      }
    else
      {
	my ($body) = gen_body();
	
	my $template = HTML::Template->new(filename=>'/opt/apache/CoGe/tmpl/generic_page.tmpl');
	
	$template->param(TITLE=>'CoGe: Secret Projects: Code Fusion');
	$template->param(HEAD=>qq{});
	my $name = $USER->user_name;
        $name = $USER->first_name if $USER->first_name;
        $name .= " ".$USER->last_name if $USER->first_name && $USER->last_name;
        $template->param(USER=>$name);

	$template->param(LOGON=>1) unless $USER->user_name eq "public";
	$template->param(DATE=>$DATE);
	$template->param(LOGO_PNG=>"CoGe-logo.png");
	$template->param(BODY=>$body);
	$html .= $template->output;
      }
    return $html;
  }
sub gen_body
    {
      my $form = shift || $FORM;
      my $template = HTML::Template->new(filename=>'/opt/apache/CoGe/tmpl/CodeFusion.tmpl');
      my ($data,$types) = gen_data();
      $template->param(DATA=>$data);
      my $groups = join ("<br>", map {qq{<INPUT TYPE=checkbox NAME=groups id=groups value=$_ checked>$_}} keys %$types)."<br>";
      
	
      $template->param(GROUPS=>$groups);
      return $template->output;
      
    }

sub process_file
  {
    my %opts = @_;
    my $bin_size = $opts{bin_size} || 5;
    $bin_size = 1 if $bin_size < 1;
    $bin_size = 100 if $bin_size > 100;
    my $skip = $opts{skip} || [];#[qw(mitochond chloroplast virus phage)];
    my $keep = $opts{keep} || [];#[qw(mitochondr)];
    my $file = $ENV{PATH}."/data/other/code_fusion_all_percent.txt";
    my %data;
    my %types;
    open (IN, $file) || die;;
    my $header = <IN>;
    chomp $header;
    my @header = split /\t/,$header;
    map {s/%//}@header;
    my ($max_aa, $max_codon, $max_trna)=(0,0,0);
    line: while (<IN>)
      {
	chomp;
	my @line = split /\t/;
	$types{$line[0]}=1;
	if (@$skip)
	  {
	    foreach my $item (@$skip)
	      {
		if ($line[0]=~/$item/i)
		  {
#		    print "skipping", $line[0],"\n";
		    next line ;
		  }
	      }
	  }
	if (@$keep)
	  {
	    my $skip = 1;
	    foreach my $item (@$keep)
	      {
		$skip = 0 if $line[0]=~/$item/i;
	      }
	    next line if $skip;
	  }
	my $bin = sprintf("%.0f", 100*$line[-2]/$bin_size)*$bin_size;
	for (my $i = 3; $i < @header; $i++)
	  {
	    if (length ($header[$i]) ==1)
	      {
		$max_aa = $line[$i] if $line[$i] =~ /^[\d\.]+$/ && $line[$i] > $max_aa;
	      }
	    elsif (length ($header[$i]) ==3)
	      {
		$max_codon = $line[$i] if  $line[$i] =~ /^[\d\.]+$/ && $line[$i] > $max_codon;
	      }
	    elsif (length ($header[$i]) ==4)
	      {
		$max_trna = $line[$i] if  $line[$i] =~ /^[\d\.]+$/ && $line[$i] > $max_trna;
	      }
	    push @{$data{$bin}{$header[$i]}}, $line[$i];
	  }
      }
    close IN;
    my $len = $#header; 
    my %return_data;
    foreach my $bin (sort keys %data)
      {
	$return_data{$bin}{bin_count}=scalar @{$data{$bin}{"A"}};
	foreach my $cat (@header[3..$#header])
	  {
	    my $ave = sprintf("%.4f",Statistics::Basic::Mean->new($data{$bin}{$cat})->query);	    
	    $return_data{$bin}{data}{$cat}=$ave;
	  }
	$return_data{$bin}{data}{"*"} = 0 unless $return_data{$bin}{data}{"*"};
      }
    return \%return_data,\%types, {max_aa=>$max_aa,max_codon=>$max_codon,max_trna=>$max_trna};
  }

sub gen_data
  {
    my %opts = @_[0..3] if @_;
    shift;    shift;    shift;    shift;
    my $form = $opts{form} || $FORM;
    my $code_layout = $opts{code_layout} || 0;
    my $bin_size = $opts{bin_size} || 5;
    my @groups = @_;
    my $code = CoGe::Accessory::genetic_code->code;
    $code = $code->{code};
    
    my ($data,$types, $max_vals) = process_file(bin_size=>$bin_size, keep=>\@groups);
    my %aa2codon;
    foreach my $item (keys %$code)
      {
	push @{$aa2codon{$code->{$item}}},$item;
      }
    my $aa_sort = CoGe::Accessory::genetic_code->sort_aa_by_gc();
    my $html;
    $html .= "<table>";
    $html .= "<tr><th>".join ("<th>", "GC% (org count)", map {$_." (".$data->{$_}{bin_count}.")" } sort keys %$data);
    foreach my $aa (sort {$aa_sort->{$b} <=> $aa_sort->{$a} || $a cmp $b}keys %$aa_sort)
      {	
	$html .= "<tr><td>$aa (GC:".sprintf("%.0f",100*$aa_sort->{$aa})."%)";
	foreach my $bin (sort keys %$data)
	  {
	    my $aa_val = sprintf("%.2f",100*$data->{$bin}{data}{$aa});
	    my $color = color_by_usage(100*$max_vals->{max_aa},$aa_val) if $max_vals->{max_aa};
	    $html .= "<td style=\"background-color: rgb($color,255,$color)\">".$aa_val."%";
	  }
      }
    $html .= "</table>";
    if ($code_layout)
      {
	foreach my $bin (sort keys %$data)
	  {
	    my $bin_count = $data->{$bin}{bin_count};
	    $html .= "GC BIN: $bin ($bin_count organisms)";
	    my $tmp = $data->{$bin}{data};
	    $html .= CoGe::Accessory::genetic_code->html_code_table(data=>$tmp);
	    $html .= "amino acid usage using organism's genetic code";
	    $html .= CoGe::Accessory::genetic_code->html_aa(data=>$tmp);
	  }
      }
     else
      {
	$html .= "<table>";
	$html .= "<tr><th>".join ("<th>", "GC% (org count)", map {$_." (".$data->{$_}{bin_count}.")" } sort keys %$data);
	foreach my $aa (sort {$aa_sort->{$b} <=> $aa_sort->{$a} || $a cmp $b}keys %$aa_sort)
	      {	
		$html .= "<tr><td>$aa (GC:".sprintf("%.0f",100*$aa_sort->{$aa})."%)";
		foreach my $bin (sort keys %$data)
		  {
		    my $aa_val = sprintf("%.2f",100*$data->{$bin}{data}{$aa});
		    my $color = color_by_usage(100*$max_vals->{max_aa},$aa_val) if $max_vals->{max_aa};
		    $html .= "<td style=\"background-color: rgb($color,255,$color)\">".$aa_val."%";
		  }
		foreach my $codon (sort { sort_nt1(substr($a, 0, 1)) <=> sort_nt1(substr($b,0, 1)) || sort_nt1(substr($a,1,1)) <=> sort_nt1(substr($b,1,1)) || sort_nt1(substr($a,2,1)) <=> sort_nt1(substr($b,2,1)) } @{$aa2codon{$aa}})
		  {
		    $html .= "<tr><td align=right>$codon";
		    foreach my $bin (sort keys %$data)
		      {
			my $current_val = sprintf("%.2f",100*$data->{$bin}{data}{$codon});
			my $color = color_by_usage(100*$max_vals->{max_codon}, $current_val) if $max_vals->{max_codon} > 0;
			my $color2 = 200+color_by_usage(100*$max_vals->{max_codon}, $current_val, 55) if $max_vals->{max_codon} > 0;
			$html .= "<td style=\"background-color: rgb(255,$color2,$color)\" >".$current_val."%";
		      }
		  }
	      }
	$html .= "</table>";
      }
    return $html,$types;
  }


sub sort_nt1
  {
    my $chr = uc(shift);

    $chr = substr($chr, -1,1) if length($chr)>1;
    my $val = 0;
    if ($chr eq "G")
      {
	$val = 1;
      }
    elsif ($chr eq "A")
      {
	$val = 2;
      }
    elsif ($chr eq "T")
      {
	$val = 3;
      }
    return $val;
  }

sub sort_nt2
  {
    my $chr = uc(shift);

    $chr = substr($chr, -1,1) if length($chr)>1;
    my $val = 0;
    if ($chr eq "G")
      {
	$val = 1;
      }
    elsif ($chr eq "A")
      {
	$val = 2;
      }
    elsif ($chr eq "T")
      {
	$val = 3;
      }
    return $val;
  }

sub sort_nt3
  {
    my $chr = uc(shift);

    $chr = substr($chr, -1,1) if length($chr)>1;
    my $val = 0;
    if ($chr eq "G")
      {
	$val = 1;
      }
    elsif ($chr eq "T")
      {
	$val = 2;
      }
    elsif ($chr eq "C")
      {
	$val = 3;
      }
    return $val;
  }

sub commify
    {
      my $text = reverse $_[0];
      $text =~ s/(\d\d\d)(?=\d)(?!\d*\.)/$1,/g;
      return scalar reverse $text;
    }
sub color_by_usage
      {
	my ($max,$value, $opt) = @_;
	$opt = 255 unless $opt;
	return $opt unless $max;
	my $g = $opt*(($max - $value) / $max);
	return int($g + .5);
      }


1;
