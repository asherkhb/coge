package CoGe::Accessory::bl2seq_report::HSP;
###############################################################################
# bl2seqReport::HSP
###############################################################################

use strict;
use base qw(Class::Accessor);

use Data::Dumper;


BEGIN
  {
    use vars qw($VERSION);
    $VERSION = "0.01";
    __PACKAGE__->mk_accessors qw(score bits percent_id match positive length pval query_start query_stop subject_start subject_stop query_alignment subject_alignment alignment query_gaps subject_gaps strand number);
  }

#ripped from class::Accessor
sub new {
    my($proto, $fields) = @_;
    my($class) = ref $proto || $proto;

    $fields = {} unless defined $fields;

    # make a copy of $fields.
    my $hsp = bless {%$fields}, $class;
    $hsp->percent_id(int(1000 * $hsp->match/$hsp->length)/10) if $hsp->match && $hsp->length;
    $hsp->pval("1".$hsp->pval) if $hsp->pval && $hsp->pval =~ /^e/;
    return $hsp;

  }


sub P               {shift->pval(@_)}
sub p               {shift->pval(@_)}
sub P_val           {shift->pval(@_)}
sub p_val           {shift->pval(@_)}
sub eval            {shift->pval(@_)}

sub query_begin      {shift->query_start(@_)}
sub query_end        {shift->query_stop(@_)}
sub subject_begin    {shift->subject_start(@_)}
sub subject_end      {shift->subject_stop(@_)}
sub qbegin      {shift->query_start(@_)}
sub qend        {shift->query_stop(@_)}
sub sbegin    {shift->subject_start(@_)}
sub send      {shift->subject_stop(@_)}
sub qstart      {shift->query_start(@_)}
sub qstop        {shift->query_stop(@_)}
sub sstart    {shift->subject_start(@_)}
sub sstop      {shift->subject_stop(@_)}
sub qb      {shift->query_start(@_)}
sub qe        {shift->query_stop(@_)}
sub sb    {shift->subject_start(@_)}
sub se      {shift->subject_stop(@_)}

sub qalign  {shift->query_alignment(@_)}
sub salign  {shift->subject_alignment(@_)}
sub qseq  {shift->query_alignment(@_)}
sub sseq  {shift->subject_alignment(@_)}
sub queryAlignment  {shift->query_alignment(@_)}
sub sbjctAlignment  {shift->subject_alignment(@_)}
sub qa  {shift->query_alignment(@_)}
sub sa  {shift->subject_alignment(@_)}

sub alignmentString {shift->alignment(@_)}
sub alignment_string {shift->alignment(@_)}
sub align {shift->alignment(@_)}

sub qgaps       {shift->query_gaps(@_)}
sub sgaps       {shift->subject_gaps(@_)}
sub qgap       {shift->query_gaps(@_)}
sub sgap       {shift->subject_gaps(@_)}
sub qg       {shift->query_gaps(@_)}
sub sg       {shift->subject_gaps(@_)}




1;
