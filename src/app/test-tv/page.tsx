export default function TestTV() {
  const testIds = [
    { name: 'France 24', id: 'UCCZVecthB8pqXqSMRVs2Ngg' },
    { name: 'TRT World', id: 'UC7fWeaHhqgM4Ry-RMpM2YYw' },
    { name: 'WION', id: 'UC_gUM8rL-LrgCAAxkHZ-cxQ' },
    { name: 'EuroNews', id: 'UCSrZ3GWwnbZa1qRxGcX24Rgw' },
    { name: 'ABC News AU', id: 'UC7VHFwXh_kEQ8gofQ9rBmlg' },
    { name: 'Arirang', id: 'UCcbImEAOpefOL6TjBvD1zmw' },
    { name: 'NDTV', id: 'UCZFMm1mMw0F81Z37aaEzTUA' },
    { name: 'CGTN', id: 'UCgrNz-aDmcrQl4QuEJYE-1g' },
    { name: 'Sky News Australia', id: 'UCO0akfuqlJkbtaY_gGEA_PQ' },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 20 }}>
      {testIds.map(t => (
        <div key={t.id} style={{ width: 300 }}>
          <h3>{t.name}</h3>
          <iframe 
            width="300" 
            height="200" 
            src={`https://www.youtube.com/embed/live_stream?channel=${t.id}&autoplay=1&mute=1`}
          />
        </div>
      ))}
    </div>
  );
}
