package Koha::Plugin::Com::Lira::ReadingLists;

use Modern::Perl;
use Mojo::JSON qw(decode_json);
use base qw(Koha::Plugins::Base);

our $VERSION = '1.0.1';
our $metadata = {
    name            => 'LIRA Reading Lists API',
    author          => 'LIRA',
    date_authored   => '2026-10-13',
    date_updated    => '2026-10-13',
    minimum_version => '18.11',
    version         => $VERSION,
    description     => 'Adds patron-scoped reading list API routes for LIRA.',
};

sub new {
    my ( $class, $args ) = @_;
    $args->{metadata} = $metadata;
    return $class->SUPER::new($args);
}

sub api_namespace {
    return 'lira-lists';
}

# Koha registers public plugin methods during installation. The base class
# provides these methods, but they must also be visible on this plugin class
# for Koha's enable/disable management actions to be registered.
sub enable {
    my ($self, @args) = @_;
    return $self->SUPER::enable(@args);
}

sub disable {
    my ($self, @args) = @_;
    return $self->SUPER::disable(@args);
}

sub api_routes {
    my ($self) = @_;
    return decode_json( $self->mbf_read('openapi.json') );
}

1;
