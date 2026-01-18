export interface CSVRow {
  storeName: string
  item: string
  quantity: string
  rarity: string
  gold: string
  silver: string
  copper: string
}

interface DataTableProps {
  data: CSVRow[]
}

export function DataTable({ data }: DataTableProps) {
  if (!data.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Store Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Item
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Qty
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Rarity
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Gold
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Silver
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
              Copper
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.storeName}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.item}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.quantity}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.rarity}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.gold}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.silver}</td>
              <td className="px-3 py-2 text-sm text-gray-900 border">{row.copper}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

