'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatMoney, formatMoneyShort } from '@/lib/utils';

const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#f1f5f9';

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

/** Categorical palette, ordered so adjacent series stay distinguishable. */
export const SERIES_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#db2777',
];

export function SalaryByDepartmentChart({
  data,
}: {
  data: { department: string; totalNet: number; headcount: number }[];
}) {
  if (data.length === 0) {
    return <ChartEmpty message="No salary data for the selected filters." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="department" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoneyShort(v)}
          width={62}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number, name) =>
            name === 'totalNet' ? [formatMoney(value), 'Net salary'] : [value, 'Headcount']
          }
        />
        <Bar dataKey="totalNet" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; netSalary: number; payslips: number }[];
}) {
  const hasData = data.some((d) => d.netSalary > 0);
  if (!hasData) return <ChartEmpty message="No payroll history yet." />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoneyShort(v)}
          width={62}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number) => [formatMoney(value), 'Net salary']}
        />
        <Line
          type="monotone"
          dataKey="netSalary"
          stroke="#7c3aed"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#7c3aed' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TimeOffByTypeChart({
  data,
}: {
  data: { name: string; colorHex: string; days: number }[];
}) {
  if (data.length === 0) return <ChartEmpty message="No approved leave in this period." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="days"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={88}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.colorHex || SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value} day(s)`, '']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AttendanceBreakdownChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <ChartEmpty message="No attendance records in this period." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} record(s)`, '']} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
      {message}
    </div>
  );
}
