package Koha::Plugin::Com::Lira::ReadingLists::Controller;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Koha::Biblios;
use Koha::Patrons;
use Koha::Virtualshelf;
use Koha::Virtualshelves;

sub _positive_id {
    my ($value) = @_;
    return defined($value) && $value =~ /^[1-9][0-9]*$/ && $value <= 9_007_199_254_740_991;
}

sub _patron {
    my ( $self, $patron_id ) = @_;
    return unless _positive_id($patron_id);
    return Koha::Patrons->find($patron_id);
}

sub _owned_shelf {
    my ( $self, $patron_id, $list_id ) = @_;
    return unless _positive_id($patron_id) && _positive_id($list_id);
    my $shelf = Koha::Virtualshelves->find($list_id) or return;
    return unless !$shelf->public && $shelf->owner && $shelf->owner == $patron_id;
    return $shelf;
}

sub _list_json {
    my ($shelf) = @_;
    return {
        id         => 0 + $shelf->shelfnumber,
        name       => $shelf->shelfname,
        created_at => '' . $shelf->created_on,
        updated_at => '' . $shelf->lastmodified,
    };
}

sub _bookmark_json {
    my ( $shelf, $biblio, $created_at ) = @_;
    return {
        id         => 0 + $biblio->biblionumber,
        user_id    => 0 + $shelf->owner,
        list_id    => 0 + $shelf->shelfnumber,
        book_id    => 0 + $biblio->biblionumber,
        title      => $biblio->title // '',
        author     => $biblio->author,
        created_at => (defined $created_at ? '' . $created_at : '' . $shelf->lastmodified),
    };
}

sub list_lists {
    my ($self) = @_;
    my $patron_id = $self->param('patron_id');
    return $self->render( status => 400, json => { error => 'Invalid patron ID' } ) unless _positive_id($patron_id);
    return $self->render( status => 404, json => { error => 'Patron not found' } ) unless $self->_patron($patron_id);
    my @shelves = Koha::Virtualshelves->search(
        { owner => $patron_id, public => 0 },
        { order_by => { -asc => 'shelfname' } }
    )->as_list;
    return $self->render( status => 200, openapi => [ map { _list_json($_) } @shelves ] );
}

sub create_list {
    my ($self) = @_;
    my $patron_id = $self->param('patron_id');
    my $input = $self->req->json // {};
    my $name = $input->{name} // '';
    $name =~ s/^\s+|\s+$//g;
    return $self->render( status => 400, json => { error => 'Invalid patron ID' } ) unless _positive_id($patron_id);
    return $self->render( status => 404, json => { error => 'Patron not found' } ) unless $self->_patron($patron_id);
    return $self->render( status => 400, json => { error => 'List name must be between 1 and 60 characters' } )
        unless length($name) >= 1 && length($name) <= 60;
    my $shelf = Koha::Virtualshelf->new({
        shelfname                  => $name,
        owner                      => $patron_id,
        public                     => 0,
        sortfield                  => 'title',
        allow_change_from_owner    => 1,
        allow_change_from_others   => 0,
    });
    return $self->render( status => 409, json => { error => 'A list with that name already exists' } )
        unless $shelf->is_shelfname_valid;
    $shelf->store;
    return $self->render( status => 201, openapi => _list_json($shelf) );
}

sub rename_list {
    my ($self) = @_;
    my $shelf = $self->_owned_shelf( $self->param('patron_id'), $self->param('list_id') );
    return $self->render( status => 404, json => { error => 'List not found' } ) unless $shelf;
    my $input = $self->req->json // {};
    my $name = $input->{name} // '';
    $name =~ s/^\s+|\s+$//g;
    return $self->render( status => 400, json => { error => 'List name must be between 1 and 60 characters' } )
        unless length($name) >= 1 && length($name) <= 60;
    $shelf->shelfname($name);
    return $self->render( status => 409, json => { error => 'A list with that name already exists' } )
        unless $shelf->is_shelfname_valid;
    $shelf->store;
    return $self->render( status => 200, openapi => _list_json($shelf) );
}

sub delete_list {
    my ($self) = @_;
    my $shelf = $self->_owned_shelf( $self->param('patron_id'), $self->param('list_id') );
    return $self->render( status => 404, json => { error => 'List not found' } ) unless $shelf;
    $shelf->delete;
    return $self->render( status => 204, text => '' );
}

sub list_items {
    my ($self) = @_;
    my $shelf = $self->_owned_shelf( $self->param('patron_id'), $self->param('list_id') );
    return $self->render( status => 404, json => { error => 'List not found' } ) unless $shelf;
    my @contents = $shelf->get_contents->as_list;
    my @items;
    for my $content (@contents) {
        my $biblio = Koha::Biblios->find( $content->biblionumber );
        next unless $biblio;
        push @items, _bookmark_json( $shelf, $biblio, $content->dateadded );
    }
    return $self->render( status => 200, openapi => \@items );
}

sub list_all_bookmarks {
    my ($self) = @_;
    my $patron_id = $self->param('patron_id');
    return $self->render( status => 400, json => { error => 'Invalid patron ID' } ) unless _positive_id($patron_id);
    return $self->render( status => 404, json => { error => 'Patron not found' } ) unless $self->_patron($patron_id);
    my @shelves = Koha::Virtualshelves->search({ owner => $patron_id, public => 0 })->as_list;
    my @items;
    for my $shelf (@shelves) {
        my @contents = $shelf->get_contents->as_list;
        for my $content (@contents) {
            my $biblio = Koha::Biblios->find( $content->biblionumber );
            next unless $biblio;
            push @items, _bookmark_json( $shelf, $biblio, $content->dateadded );
        }
    }
    return $self->render( status => 200, openapi => \@items );
}

sub add_item {
    my ($self) = @_;
    my $shelf = $self->_owned_shelf( $self->param('patron_id'), $self->param('list_id') );
    return $self->render( status => 404, json => { error => 'List not found' } ) unless $shelf;
    my $biblio_id = $self->param('biblio_id');
    return $self->render( status => 400, json => { error => 'Invalid bibliographic record ID' } ) unless _positive_id($biblio_id);
    my $biblio = Koha::Biblios->find($biblio_id);
    return $self->render( status => 404, json => { error => 'Book not found in Koha' } ) unless $biblio;
    $shelf->add_biblio( $biblio_id, $shelf->owner );
    return $self->render( status => 200, openapi => _bookmark_json($shelf, $biblio) );
}

sub remove_item {
    my ($self) = @_;
    my $shelf = $self->_owned_shelf( $self->param('patron_id'), $self->param('list_id') );
    return $self->render( status => 404, json => { error => 'List not found' } ) unless $shelf;
    my $biblio_id = $self->param('biblio_id');
    return $self->render( status => 400, json => { error => 'Invalid bibliographic record ID' } ) unless _positive_id($biblio_id);
    $shelf->remove_biblios({ biblionumbers => [$biblio_id], borrowernumber => $shelf->owner });
    return $self->render( status => 204, text => '' );
}

sub move_item {
    my ($self) = @_;
    my $patron_id = $self->param('patron_id');
    my $biblio_id = $self->param('biblio_id');
    my $input = $self->req->json // {};
    my $destination = $self->_owned_shelf( $patron_id, $input->{list_id} );
    return $self->render( status => 404, json => { error => 'Destination list not found' } ) unless $destination;
    return $self->render( status => 400, json => { error => 'Invalid bibliographic record ID' } ) unless _positive_id($biblio_id);
    my $biblio = Koha::Biblios->find($biblio_id);
    return $self->render( status => 404, json => { error => 'Book not found in Koha' } ) unless $biblio;
    my @shelves = Koha::Virtualshelves->search({ owner => $patron_id, public => 0 })->as_list;
    my @sources = grep { $_->shelfnumber != $destination->shelfnumber } @shelves;
    $destination->add_biblio( $biblio_id, $patron_id );
    $_->remove_biblios({ biblionumbers => [$biblio_id], borrowernumber => $patron_id }) for @sources;
    return $self->render( status => 200, openapi => _bookmark_json($destination, $biblio) );
}

1;
