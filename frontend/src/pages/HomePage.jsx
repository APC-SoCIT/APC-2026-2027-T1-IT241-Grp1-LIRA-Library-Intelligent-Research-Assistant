import Navbar from '../components/Navbar'
import HeroSection from '../components/HeroSection'
import AnnouncementsSection from '../components/AnnouncementsSection'
import FeaturedBooksSection from '../components/FeaturedBooksSection'
import NewArrivalsSection from '../components/NewArrivalsSection'
import OnlineResourcesSection from '../components/OnlineResourcesSection'
import OnlineFormsSection from '../components/OnlineFormsSection'
import LibraryCatalogueSection from '../components/LibraryCatalogueSection'
import UtilizationSection from '../components/UtilizationSection'
import OthersSection from '../components/OthersSection'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <AnnouncementsSection />
        <FeaturedBooksSection />
        <NewArrivalsSection />
        <OnlineResourcesSection />
        <OnlineFormsSection />
        <LibraryCatalogueSection />
        <UtilizationSection />
        <OthersSection />
      </main>
      <Footer />
    </div>
  )
}
