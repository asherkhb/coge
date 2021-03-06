package CoGe::Factory::PipelineFactory;

use Moose;

use File::Spec::Functions qw(catfile);
use Data::Dumper;

use CoGe::Core::Storage qw(get_workflow_paths);
use CoGe::Builder::Export::Fasta;
use CoGe::Builder::Export::Gff;
use CoGe::Builder::Export::Genome;
use CoGe::Builder::Export::Experiment;
use CoGe::Builder::Load::Experiment;
use CoGe::Builder::Load::BatchExperiment;
use CoGe::Builder::Load::Genome;
use CoGe::Builder::Load::Annotation;
use CoGe::Builder::SNP::IdentifySNPs;
use CoGe::Builder::Tools::CoGeBlast;
use CoGe::Builder::Tools::SynMap;
use CoGe::Builder::Tools::SynMap3D;
use CoGe::Builder::Expression::MeasureExpression;
use CoGe::Builder::Methylation::CreateMetaplot;
use CoGe::Builder::PopGen::MeasureDiversity;

has 'db' => (
    is => 'ro',
    required => 1
);

has 'conf' => (
    is => 'ro',
    required => 1
);

has 'user' => (
    is  => 'ro',
    required => 1
);

has 'jex' => (
    isa => 'CoGe::JEX::Jex',
    is => 'ro',
    required => 1
);

sub get {
    my ($self, $message) = @_;

    my $request = {
        params    => $message->{parameters},
        db        => $self->db,
        user      => $self->user,
        conf      => $self->conf
    };

    # Select pipeline builder
    my $builder;
    if ($message->{type} eq "blast") {
        $builder = CoGe::Builder::Tools::CoGeBlast->new($request);
    }
    elsif ($message->{type} eq "export_gff") {
        $builder = CoGe::Builder::Export::Gff->new($request);
    }
    elsif ($message->{type} eq "export_fasta") {
        $builder = CoGe::Builder::Export::Fasta->new($request);
    }
    elsif ($message->{type} eq "export_genome") {
        $builder = CoGe::Builder::Export::Genome->new($request);
    }
    elsif ($message->{type} eq "export_experiment") {
        $builder = CoGe::Builder::Export::Experiment->new($request);
    }
    elsif ($message->{type} eq "load_experiment") {
        $builder = CoGe::Builder::Load::Experiment->new($request);
    }
    elsif ($message->{type} eq "load_batch") {
        $builder = CoGe::Builder::Load::BatchExperiment->new($request);
    }
    elsif ($message->{type} eq "load_genome") {
        $builder = CoGe::Builder::Load::Genome->new($request);
    }
    elsif ($message->{type} eq "load_annotation") {
        $builder = CoGe::Builder::Load::Annotation->new($request);
    }
    elsif ($message->{type} eq "analyze_snps") {
        $builder = CoGe::Builder::SNP::IdentifySNPs->new($request);
    }
    elsif ($message->{type} eq "synmap") {
        $builder = CoGe::Builder::Tools::SynMap->new($request);
    }
    elsif ($message->{type} eq "synmap3d") {
        $builder = CoGe::Builder::Tools::SynMap3D->new($request);
    }
    elsif ($message->{type} eq "analyze_expression") {
        $builder = CoGe::Builder::Expression::MeasureExpression->new($request);
    }
    elsif ($message->{type} eq "analyze_metaplot") {
        $builder = CoGe::Builder::Methylation::CreateMetaplot->new($request);
    }        
    elsif ($message->{type} eq "analyze_diversity") {
        $builder = CoGe::Builder::PopGen::MeasureDiversity->new($request);
    }
    else {
        print STDERR "PipelineFactory::get unknown type\n";
        return;
    }

    #
    # Construct the workflow
    #

    $builder->pre_build(jex => $self->jex, requester => $message->{requester});
    my $rc = $builder->build();
    unless ($rc) {
        $rc = 'undef' unless defined $rc;
        print STDERR "PipelineFactory::get build failed, rc=$rc\n";
        return;
    }

    # Add completion tasks (such as sending notifiation email)
    $builder->post_build();

    # Dump raw workflow to file for debugging
    if ($builder->result_dir) {
        my $cmd = 'chmod g+rw ' . $builder->result_dir;
        `$cmd`;
        open(my $fh, '>', catfile($builder->result_dir, 'workflow.log'));
        print $fh Dumper $builder->workflow, "\n";
        close($fh);
    }
    
    return $builder;
}

1;
