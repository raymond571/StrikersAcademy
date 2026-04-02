import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';

export default function LandingPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          Train Like a <span className="text-brand-500">Champion</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Book net sessions and turf wicket slots at StrikersAcademy, Chennai.
          Professional bowling machines, coached sessions, and more.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/register" className="btn-primary text-base px-6 py-3">
            Book a Slot
          </Link>
          <Link to="/login" className="btn-secondary text-base px-6 py-3">
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          {
            title: 'Net Lanes',
            desc: 'Bowling machine-equipped net lanes for focused batting practice.',
            color: 'bg-brand-50 border-brand-200',
          },
          {
            title: 'Turf Wickets',
            desc: 'Full-size turf pitch for realistic match-condition practice.',
            color: 'bg-pitch-50 border-pitch-100',
          },
          {
            title: 'Easy Booking',
            desc: 'Pick a date, choose your slot, pay via UPI instantly.',
            color: 'bg-blue-50 border-blue-100',
          },
        ].map((f) => (
          <div key={f.title} className={`card border ${f.color}`}>
            <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
          </div>
        ))}
      </section>
    </Layout>
  );
}
