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
import { useEffect, useState } from 'react'
import { listCatalogBooks, listNewArrivalBooks } from '../services/catalogService'

export default function HomePage() {
  const [featuredBooks, setFeaturedBooks] = useState([])
  const [newArrivals, setNewArrivals] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([listCatalogBooks(), listNewArrivalBooks()])
      .then(([catalog, arrivals]) => {
        if (!active) return
        setFeaturedBooks(catalog.slice(0, 12))
        setNewArrivals(arrivals)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <AnnouncementsSection />
        <FeaturedBooksSection books={featuredBooks} />
        <NewArrivalsSection books={newArrivals} />
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
