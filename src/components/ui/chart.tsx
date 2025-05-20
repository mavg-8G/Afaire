
"use client"

import * as React from "react"
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "next-themes"
import { useTranslations } from "@/contexts/language-context"

export type BarChartDataItem = {
  name: string; // Label for X-axis (e.g., day name, week number)
  // Dynamically add keys for bars, e.g., total: number, completed: number
  [key: string]: string | number;
};

export type BarProps = {
  dataKey: string;
  fillVariable: string; // e.g., "--chart-1", will be used as hsl(var(fillVariable))
  nameKey: keyof Translations; // Key for legend name from translations
  radius?: [number, number, number, number];
  barSize?: number;
};

interface CustomBarChartProps {
  data: BarChartDataItem[];
  bars: BarProps[];
  xAxisDataKey: string;
  height?: number;
  showLegend?: boolean;
}

export function BarChart({
  data,
  bars,
  xAxisDataKey,
  height = 350,
  showLegend = true,
}: CustomBarChartProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslations();

  // Determine max Y-axis value for better scaling
  let maxYValue = 0;
  if (data.length > 0) {
    maxYValue = data.reduce((max, currentItem) => {
      const itemMax = bars.reduce((barMax, bar) => Math.max(barMax, Number(currentItem[bar.dataKey] || 0)), 0);
      return Math.max(max, itemMax);
    }, 0);
  }
   // Ensure maxYValue is at least a small number to avoid issues with empty datasets or all-zero data
  if (maxYValue === 0) maxYValue = 10;


  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
        <XAxis
          dataKey={xAxisDataKey}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={5}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
          domain={[0, Math.ceil(maxYValue * 1.1)]} // Add 10% padding to max value
          allowDecimals={false}
          dx={-2}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06))", // A generic shadow
          }}
          labelStyle={{ color: "hsl(var(--foreground))", marginBottom: '4px', fontWeight: '500' }}
          itemStyle={{ color: "hsl(var(--foreground))" }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={`hsl(var(${bar.fillVariable}))`}
            name={t(bar.nameKey as any) as string} // Type assertion, ensure nameKey is valid
            radius={bar.radius || [4, 4, 0, 0]}
            barSize={bar.barSize || undefined} // Recharts default barSize is fine
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
