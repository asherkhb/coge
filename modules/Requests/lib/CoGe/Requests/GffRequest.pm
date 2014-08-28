package CoGe::Requests::GffRequest;

use Moose;
use CoGe::Requests::Request;
use JSON;

sub is_valid {
    my $self = shift;

    # Verify that the genome exists
    my $gid = $self->parameters->{gid};
    my $genome = $self->db->resultset("Genome")->find($gid);
    return defined $genome ? 1 : 0;
}

sub has_access {
    my $self = shift;

    my $gid = $self->parameters->{gid};
    my $genome = $self->db->resultset("Genome")->find($gid);
    return $self->user->has_access_to_genome($genome);
}

with qw(CoGe::Requests::Request);
1;
