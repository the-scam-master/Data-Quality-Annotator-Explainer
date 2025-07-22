import { type NextRequest, NextResponse } from "next/server"

interface DataIssue {
  column: string
  severity: "Critical" | "Warning" | "Info"
  type: string
  description: string
  count: number
  percentage: number
  explanation: string
  recommendation: string
}

interface AnalysisResult {
  summary: string
  totalRows: number
  totalColumns: number
  issues: DataIssue[]
  overallScore: number
}

// Mock Gemini API call - replace with actual API integration
async function callGeminiAPI(prompt: string): Promise<string> {
  // In production, replace this with actual Gemini API call
  // For demo purposes, returning mock responses

  if (prompt.includes("dataset summary")) {
    return "This dataset appears to be a customer database with demographic and transaction information. It contains user profiles with geographic data, purchase history, and engagement metrics. The data structure suggests it's used for customer analytics and segmentation purposes."
  }

  if (prompt.includes("missing values")) {
    return "Missing values in this column likely indicate incomplete data collection during user registration or data integration issues from multiple sources. This can impact customer segmentation accuracy and lead to biased analytics results."
  }

  if (prompt.includes("duplicate")) {
    return "Duplicate records suggest data integration issues or multiple data entry points without proper deduplication. This can lead to inflated metrics and incorrect customer counts in business reports."
  }

  return "Data quality issue detected that requires attention for accurate analysis."
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
    if (values.length === headers.length) {
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index]
      })
      data.push(row)
    }
  }

  return data
}

function analyzeDataQuality(data: any[]): DataIssue[] {
  if (!data.length) return []

  const issues: DataIssue[] = []
  const columns = Object.keys(data[0])
  const totalRows = data.length

  columns.forEach((column) => {
    // Check for missing values
    const missingCount = data.filter(
      (row) => !row[column] || row[column] === "" || row[column] === "null" || row[column] === "undefined",
    ).length

    if (missingCount > 0) {
      const percentage = (missingCount / totalRows) * 100
      issues.push({
        column,
        severity: percentage > 20 ? "Critical" : percentage > 5 ? "Warning" : "Info",
        type: "Missing Values",
        description: `${missingCount} missing values found`,
        count: missingCount,
        percentage,
        explanation: `Missing values in ${column} column likely indicate incomplete data collection or integration issues.`,
        recommendation:
          percentage > 10
            ? `Consider data imputation strategies or investigate data collection process for ${column}.`
            : `Monitor ${column} data collection to prevent further missing values.`,
      })
    }

    // Check for duplicates
    const values = data.map((row) => row[column]).filter((v) => v)
    const uniqueValues = new Set(values)
    const duplicateCount = values.length - uniqueValues.size

    if (duplicateCount > 0 && column.toLowerCase().includes("id")) {
      const percentage = (duplicateCount / totalRows) * 100
      issues.push({
        column,
        severity: "Critical",
        type: "Duplicate Values",
        description: `${duplicateCount} duplicate values in ID column`,
        count: duplicateCount,
        percentage,
        explanation: `Duplicate IDs indicate data integrity issues that can cause incorrect analysis results.`,
        recommendation: `Implement unique constraints and data deduplication process for ${column}.`,
      })
    }

    // Check for outliers in numeric columns
    const numericValues = data.map((row) => Number.parseFloat(row[column])).filter((v) => !isNaN(v))

    if (numericValues.length > 0) {
      const sorted = numericValues.sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      const lowerBound = q1 - 1.5 * iqr
      const upperBound = q3 + 1.5 * iqr

      const outliers = numericValues.filter((v) => v < lowerBound || v > upperBound)

      if (outliers.length > 0) {
        const percentage = (outliers.length / numericValues.length) * 100
        issues.push({
          column,
          severity: percentage > 10 ? "Warning" : "Info",
          type: "Outliers",
          description: `${outliers.length} potential outliers detected`,
          count: outliers.length,
          percentage,
          explanation: `Statistical outliers in ${column} may indicate data entry errors or genuine extreme values.`,
          recommendation: `Review outlier values in ${column} to determine if they are valid or require correction.`,
        })
      }
    }
  })

  return issues
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    let data: any[] = []

    // Parse file based on type
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      data = parseCSV(text)
    } else if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        const jsonData = JSON.parse(text)
        data = Array.isArray(jsonData) ? jsonData : [jsonData]
      } catch (e) {
        return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
      }
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    // Analyze data quality
    const issues = analyzeDataQuality(data)

    // Generate summary using mock Gemini API
    const summary = await callGeminiAPI(`Generate a dataset summary for: ${JSON.stringify(data.slice(0, 3))}`)

    // Calculate overall quality score
    const criticalIssues = issues.filter((i) => i.severity === "Critical").length
    const warningIssues = issues.filter((i) => i.severity === "Warning").length
    const totalColumns = Object.keys(data[0]).length

    const overallScore = Math.max(0, Math.round(100 - criticalIssues * 20 - warningIssues * 10))

    const result: AnalysisResult = {
      summary,
      totalRows: data.length,
      totalColumns,
      issues,
      overallScore,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze file" }, { status: 500 })
  }
}
