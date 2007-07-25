package CoGeX::Dataset;

# Created by DBIx::Class::Schema::Loader v0.03009 @ 2006-12-01 18:13:38

use strict;
use warnings;
use Data::Dumper;

use base 'DBIx::Class';

__PACKAGE__->load_components("PK::Auto", "ResultSetManager", "Core");
__PACKAGE__->table("dataset");
__PACKAGE__->add_columns(
  "dataset_id",
  { data_type => "INT", default_value => undef, is_nullable => 0, size => 10 },
  "data_source_id",
  { data_type => "INT", default_value => 0, is_nullable => 0, size => 10 },
  "organism_id",
  { data_type => "INT", default_value => "", is_nullable => 0, size => 10 },
  "name",
  { data_type => "VARCHAR", default_value => "", is_nullable => 0, size => 50 },
  "description",
  {
    data_type => "VARCHAR",
    default_value => undef,
    is_nullable => 1,
    size => 255,
  },
  "version",
  {
    data_type => "VARCHAR",
    default_value => undef,
    is_nullable => 1,
    size => 50,
  },
  "link",
  {
    data_type => "TEXT",
    default_value => undef,
    is_nullable => 1,
    size => 65535,
  },
);

__PACKAGE__->set_primary_key("dataset_id");

__PACKAGE__->has_many("features" => "CoGeX::Feature", 'dataset_id');

__PACKAGE__->has_many("genomic_sequences" => "CoGeX::GenomicSequence", 'dataset_id');

__PACKAGE__->belongs_to("datasource" => "CoGeX::DataSource", 'data_source_id');

__PACKAGE__->belongs_to("organism" => "CoGeX::Organism", 'organism_id');


sub chromosomes : ResultSet {
    my $self = shift;
    my $r1 = $self->search(undef,{
        prefetch =>['genomic_sequences']
    });
    return $r1 if $r1->count;
    # TODO: should probably just return an array here instead of 
    # full objects...
    return $self->search(undef,{
        prefetch =>[{'features' => 'locations' }]
    });

}

# get_sequence:
# $rs->get_genome_sequence( [chromosome, from, to] )
# $rs->get_genome_sequence() - returns the entire genome sequence *woot*
# $rs->get_genome_sequence(1, 42, 101) - returns chromosome 1 sequence 
#                                        from position 42 up to and
#                                        including position 101

sub get_genomic_sequence {
  my $self = shift;
  my %opts = @_;
  my $start = $opts{start} || $opts{begin};
  my $stop = $opts{stop} || $opts{end};
  my $chr = $opts{chr} || $opts{chromosome};
  my $skip_length_check = $opts{skip_length_check} || 0;
  my $str = "";
  if (defined $start && defined $stop && defined $chr)
    {
      $chr = "1" unless defined $chr;
      $start = 1 if $start < 1;
      if (! $skip_length_check)
	{
	  my $last = $self->last_chromosome_position($chr);
	  $stop = $last if $stop > $last;
	}
      # make sure two numbers were sent in
      return undef unless ($start =~ /\A\d+\z/ and  $stop =~ /\A\d+\z/);
      ($start, $stop) = ($stop, $start) if $stop < $start;
      my @seqs = $self->genomic_sequences(
					  {chromosome=>$chr,
					   -and=>[
						  -or=>[
							-and=>[
							       start => {'<='=>$stop},
							       stop  => {'>='=>$stop},
							      ],
							-and=>[
							       start => {'<='=>$start},
							       stop  => {'>='=>$start},
							      ],
							-and=>[
							       start => {'>'=>$start},
							       stop  => {'<'=>$stop},
							      ],
						       ],
						 ],
					  },
					  {order_by=>"start asc"}
					 )->all;
      $str = join ("", map{$_->sequence_data} @seqs);  
      $str = $self->trim_sequence( $str, $seqs[0]->start, $seqs[-1]->stop, $start, $stop );
      
    } 
  elsif ( $chr ) 
    {    # get a whole chromosome
      my $allseqs = $self->genomic_sequences( { 'chromosome' => $chr},
					      {order_by=>"start asc"}
					    );
      while ( my $g = $allseqs->next ) {
	$str .= $g->sequence_data;
      }
    } 
  else 
    {                 # entire sequence
      my $allseqs = $self->genomic_sequences();
      while ( my $g = $allseqs->next ) {
	$str .= $g->sequence_data;
      }
    }
  return $str;
}

sub get_genome_sequence
  {
    return shift->get_genomic_sequence(@_);
  }
#         .         .         .         .
#1234567890123456789012345678901234567890
#                                       CCACAACCAGCTGACTAGGTA
#ACGACGCAGCTATGGCCTCCCCGCCCACCAGGCCGCCAGCCACAACCAGC
#         CTATGGCCTC
sub trim_sequence {
  my $self = shift;
  my( $seq, $seqstart, $seqend, $newstart, $newend ) = @_;
  
  my $start = $newstart-$seqstart;
  my $stop = length($seq)-($seqend-$newend)-1;  
#  print STDERR join ("\t", $seqstart, $seqend, $newstart, $newend),"\n";
#  print STDERR join ("\t", length ($seq), $start, $stop, $stop-$start+1),"\n";
  $seq = substr($seq, $start, $stop-$start+1);
  return($seq);
}


################################################## subroutine header start ##

=head2 last_chromsome_position

 Usage     : my $last = $genome_seq_obj->last_chromosome_position($chr);
 Purpose   : gets the last genomic sequence position for a dataset given a chromosome
 Returns   : an integer that refers to the last position in the genomic sequence refered
             to by a dataset given a chromosome
 Argument  : string => chromsome for which the last position is sought
 Throws    : 
 Comments  : 

See Also   : 

=cut

################################################## subroutine header end ##


 sub last_chromosome_position
   {
     my $self = shift;
     my $chr = shift;
     my ($gs) =  $self->genomic_sequences(
					  {
					   dataset_id=>$self->dataset_id,
					   chromosome=>$chr,
					  },
					  {
					   order_by=>'stop DESC',
					   limit => 1,
					  }
					 );
     $gs->stop;
   }


sub resolve : ResultSet {
    my $self = shift;
    my $info = shift;
    return $info if ref($info) =~ /Dataset/i;
    return $self->search({
			  '-or'=> [
				   { 'name' => { '-like' => '%' . $info . '%'}},
				   { 'dataset_id' => $info }
				  ],
			 }
			 ,{});
  }

sub get_chromosomes
  {
    my $self = shift;
    my @data = map {$_->chromosome} $self->genomic_sequences(
					{},
					{
					 select =>["chromosome"],
					 distinct=>["chromosme"],
					},
				       );
#     unless (@data)
#       {
# 	foreach my $item ($self->features(
# 					    {
					     
# 					    },
# 					    {
# 					     select=>"locations.chromosome",
# 					     join=>"locations",
# 					     prefetch=>"locations",
# 					     distinct=>["locations.chromosome"],
# 					     prefetch=>["locations"],
# 					    },
# 					    ))
# 	  {
# 	    print $item->chromosome,"\n";
# 	  }
#       }
    return wantarray ? @data : \@data;
  }

1;
