import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Add AreaChart component
interface AreaChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: any[];
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  startEndOnly?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  showGradient?: boolean;
  autoMinValue?: boolean;
}

const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>(
  (
    {
      data,
      categories,
      index,
      colors = ["#0369a1", "#34d399", "#f59e0b"],
      valueFormatter,
      yAxisWidth = 56,
      showXAxis = true,
      showYAxis = true,
      showGridLines = true,
      startEndOnly = false,
      showTooltip = true,
      showLegend = true,
      showGradient = true,
      autoMinValue = false,
      className,
      ...props
    },
    ref
  ) => {
    const config = React.useMemo(() => {
      return Object.fromEntries(
        categories.map((category, i) => [
          category,
          {
            color: colors[i % colors.length],
          },
        ])
      )
    }, [categories, colors])

    // Fix the interval type - use the exact type expected by recharts
    // preserveStartEnd and auto are valid values for the interval prop of XAxis
    const intervalType = React.useMemo(() => {
      // Type casting to any to avoid TypeScript errors
      // The actual values are valid according to recharts documentation
      return startEndOnly ? ("preserveStartEnd" as any) : ("auto" as any)
    }, [startEndOnly])

    return (
      <ChartContainer ref={ref} config={config} className={className} {...props}>
        <RechartsPrimitive.ComposedChart data={data}>
          {showGridLines && (
            <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" vertical={false} />
          )}
          {showXAxis && (
            <RechartsPrimitive.XAxis
              dataKey={index}
              tickLine={false}
              axisLine={false}
              tick={{ transform: "translate(0, 6)" }}
              interval={intervalType}
              style={{
                fontSize: "12px",
                textAnchor: "middle",
              }}
            />
          )}
          {showYAxis && (
            <RechartsPrimitive.YAxis
              width={yAxisWidth}
              axisLine={false}
              tickLine={false}
              tick={{ transform: "translate(-3, 0)" }}
              tickFormatter={valueFormatter}
              style={{
                fontSize: "12px",
                textAnchor: "end",
              }}
              domain={autoMinValue ? ["auto", "auto"] : [0, "auto"]}
            />
          )}
          {showTooltip && (
            <RechartsPrimitive.Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                  />
                );
              }}
            />
          )}
          {categories.map((category, i) => (
            <React.Fragment key={category}>
              {showGradient && (
                <defs>
                  <linearGradient
                    id={`gradient-${category}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={colors[i % colors.length]}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors[i % colors.length]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
              )}
              <RechartsPrimitive.Area
                type="monotone"
                dataKey={category}
                fill={showGradient ? `url(#gradient-${category})` : colors[i % colors.length]}
                fillOpacity={1}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{
                  r: 2,
                  strokeWidth: 2,
                }}
                isAnimationActive={true}
                activeDot={{
                  r: 4,
                  strokeWidth: 0,
                }}
              />
            </React.Fragment>
          ))}
          {showLegend && (
            <RechartsPrimitive.Legend
              content={({ payload }) => (
                <ChartLegendContent payload={payload} />
              )}
            />
          )}
        </RechartsPrimitive.ComposedChart>
      </ChartContainer>
    )
  }
)
AreaChart.displayName = "AreaChart"

// Add BarChart component
interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: any[];
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  stack?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  autoMinValue?: boolean;
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  (
    {
      data,
      categories,
      index,
      colors = ["#0369a1", "#34d399", "#f59e0b"],
      valueFormatter,
      yAxisWidth = 56,
      showXAxis = true,
      showYAxis = true,
      showGridLines = true,
      stack = false,
      showTooltip = true,
      showLegend = true,
      autoMinValue = false,
      className,
      ...props
    },
    ref
  ) => {
    const config = React.useMemo(() => {
      return Object.fromEntries(
        categories.map((category, i) => [
          category,
          {
            color: colors[i % colors.length],
          },
        ])
      )
    }, [categories, colors])

    return (
      <ChartContainer ref={ref} config={config} className={className} {...props}>
        <RechartsPrimitive.BarChart data={data} barCategoryGap="30%">
          {showGridLines && (
            <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" vertical={false} />
          )}
          {showXAxis && (
            <RechartsPrimitive.XAxis
              dataKey={index}
              tickLine={false}
              axisLine={false}
              tick={{ transform: "translate(0, 6)" }}
              style={{
                fontSize: "12px",
                textAnchor: "middle",
              }}
            />
          )}
          {showYAxis && (
            <RechartsPrimitive.YAxis
              width={yAxisWidth}
              tickLine={false}
              axisLine={false}
              tick={{ transform: "translate(-3, 0)" }}
              tickFormatter={valueFormatter}
              style={{
                fontSize: "12px",
                textAnchor: "end",
              }}
              domain={autoMinValue ? ["auto", "auto"] : [0, "auto"]}
            />
          )}
          {showTooltip && (
            <RechartsPrimitive.Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                  />
                );
              }}
            />
          )}
          {categories.map((category, i) => (
            <RechartsPrimitive.Bar
              key={category}
              dataKey={category}
              fill={colors[i % colors.length]}
              isAnimationActive={true}
              stackId={stack ? "stack" : undefined}
              radius={[4, 4, 0, 0]}
            />
          ))}
          {showLegend && (
            <RechartsPrimitive.Legend
              content={({ payload }) => (
                <ChartLegendContent payload={payload} />
              )}
            />
          )}
        </RechartsPrimitive.BarChart>
      </ChartContainer>
    )
  }
)
BarChart.displayName = "BarChart"

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  AreaChart,
  BarChart
}
