#!/usr/bin/perl -w

use strict;
use CoGeX;
use Getopt::Long;

#$coge->storage->debugobj(new DBIxProfiler());
#$coge->storage->debug(1);

#~/src/mauve_2.3.1/linux-x64/progressiveMauve --substitution-matrix=~/projects/genome/data/K12_Kustu/syntenic-path-assembled/Mauve_MultiGenome_Alignments/nt-matrix.txt --output=alignment.aln master.faa

use vars
  qw($dsgids $out_file $GO $coge $mauve_bin $mauve_sub_matrix $muscle_args);

GetOptions(
    "dsgid=i@"            => \$dsgids,
    "go=s"                => \$GO,
    "out_file|aln_file=s" => \$out_file,
    "mauve_bin=s"         => \$mauve_bin,
    "muscle_args=s"       => \$muscle_args,
    "mauve_sub_matrix=s"  => \$mauve_sub_matrix,
);
$mauve_bin = "/home/elyons/src/mauve_2.3.1/linux-x64/progressiveMauve"
  unless $mauve_bin;
unless ( -r $mauve_bin ) {
    print "Can't read either the mauve_bin\n";
    help();
}

help() unless ( $dsgids && @$dsgids >= 2 );

my $connstr = 'dbi:mysql:dbname=DB;host=HOST;port=PORT';
$coge = CoGeX->connect($connstr, 'USER', 'PASSWORD' );
$out_file = "alignment.aln" unless $out_file;

#get_and_build_faa(dsgids=>$dsgids, file=>$faa_file, coge=>$coge);
run_mauve(
    out         => $out_file,
    bin         => $mauve_bin,
    matrix      => $mauve_sub_matrix,
    dsgids      => $dsgids,
    coge        => $coge,
    muscle_args => $muscle_args
);

sub run_mauve {
    my %opts        = @_;
    my $out         = $opts{out};
    my $bin         = $opts{bin};
    my $matrix      = $opts{matrix};
    my $dsgids      = $opts{dsgids};
    my $coge        = $opts{coge};
    my $muscle_args = $opts{muscle_args};

    my $cmd = "$bin --output=$out";
    $cmd .= " --substitution-matrix=$matrix" if $matrix && -r $matrix;
    $cmd .= " --muscle-args=\"$muscle_args\"" if $muscle_args;
    foreach my $dsgid (@$dsgids) {
        my $dsg = $coge->resultset('DatasetGroup')->find($dsgid);
        $cmd .= " " . $dsg->file_path;
    }
    print "Running $cmd. . . .\n";
    print system "$cmd";
}

sub help {
    print qq{Welcome to $0!

Usage:  $0 -dsgid 12345 -dsgid 23456 -dsgid 34567

This program takes a set of coge dataset_group ids an generates a multiple sequence alignment using Mauve.

NOTE: If multiple chromosomes exist in the genome, they will be joined by 1000Ns.

Options:

 -dsgid         CoGe Dataset_group id (must have at least two)

 -out_file | aln_file  What to name the output aln file generated by mauve.  Default:  alignment.aln

 -mauve_bin     Where the binary is to progressiveMauve

#####
#NOTE : Mauve does not accept substition matrices very well.  Not currently implemented in this script.
#####

-mauve_sub_matrix  Where the substitution matrix is for Mauve to use for generating the alignment.  If none is specified the default matrix compiled into Mauve is used:

static const score_t hoxd_matrix[4][4] = 
{ 
        {91,    -114,   -31,    -123}, // A

        {-114,  100,    -125,   -31}, // C

        {-31,   -125,   100,    -114}, // G

        {-123,  -31,    -114,   91}, // T
};
#From libMems-1.6.0/libMems/SubstitutionMatrix.h

    };
    exit;
}
