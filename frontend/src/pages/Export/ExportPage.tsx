import PageHeader from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import Button from '../../components/common/Button'
import { Download } from 'lucide-react'

const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1/export`

export default function ExportPage() {
  return (
    <div>
      <PageHeader title="Export" subtitle="Download processen en BIA-gegevens" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
        <Card>
          <h2 className="font-semibold text-gray-800 mb-1">Excel export</h2>
          <p className="text-sm text-gray-500 mb-4">Alle processen inclusief BIA-scores, RTO/RPO en gekoppelde applicaties in één Excel-bestand.</p>
          <a href={`${API}/processes.xlsx`} download>
            <Button><Download size={15} /> Download .xlsx</Button>
          </a>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-1">CSV export</h2>
          <p className="text-sm text-gray-500 mb-4">Platte CSV voor import in andere tools zoals Excel, Power BI of een CMDB.</p>
          <a href={`${API}/processes.csv`} download>
            <Button variant="secondary"><Download size={15} /> Download .csv</Button>
          </a>
        </Card>
      </div>
    </div>
  )
}
