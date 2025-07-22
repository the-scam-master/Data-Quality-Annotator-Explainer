"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, AlertCircle, CheckCircle, Loader2, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface DataIssue {
  column: string
  severity: "Critical" | "Warning" | "Info"
  type: string
  description: string
  count: number
  percentage: number
  explanation: string
  recommendation: string
  fixCode?: string
}

interface AnalysisResult {
  summary: string
  totalRows: number
  totalColumns: number
  issues: DataIssue[]
  overallScore: number
}

export default function DataQualityAnnotator() {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState("analyzed")

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0]
    if (uploadedFile && (uploadedFile.type === "text/csv" || uploadedFile.type === "application/json")) {
      setFile(uploadedFile)
      analyzeFile(uploadedFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/json": [".json"],
    },
    maxSize: 4 * 1024 * 1024, // 4MB limit for Vercel
    multiple: false,
  })

  const analyzeFile = async (file: File) => {
    setLoading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        throw new Error("Analysis failed")
      }

      const result = await response.json()
      setAnalysis(result)
    } catch (error) {
      console.error("Analysis error:", error)
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const generateFix = async (issue: DataIssue) => {
    try {
      const response = await fetch("/api/generate-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue, fileName: file?.name }),
      })

      const { fixCode } = await response.json()

      // Update the issue with the generated fix
      setAnalysis((prev) =>
        prev
          ? {
              ...prev,
              issues: prev.issues.map((i) =>
                i.column === issue.column && i.type === issue.type ? { ...i, fixCode } : i,
              ),
            }
          : null,
      )
    } catch (error) {
      console.error("Fix generation error:", error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "rgb(239, 68, 68)"
      case "Warning":
        return "rgb(245, 158, 11)"
      default:
        return "rgb(34, 197, 94)"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "Critical":
        return <AlertCircle className="w-4 h-4" />
      case "Warning":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <CheckCircle className="w-4 h-4" />
    }
  }

  const filteredIssues =
    analysis?.issues.filter((issue) => {
      switch (activeTab) {
        case "issues":
          return issue.severity === "Critical" || issue.severity === "Warning"
        case "recommendations":
          return issue.recommendation
        default:
          return true
      }
    }) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Data Quality Annotator</h1>
                {analysis && (
                  <p className="text-sm text-gray-600">
                    {analysis.totalRows.toLocaleString()} rows • {analysis.totalColumns} columns
                  </p>
                )}
              </div>
            </div>
            {analysis && (
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{analysis.overallScore}%</div>
                <div className="text-sm text-gray-600">Quality Score</div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Section */}
        {!file && (
          <div className="glass-card p-8 mb-6">
            <div {...getRootProps()} className="upload-zone">
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragActive ? "Drop your file here" : "Upload CSV/JSON"}
                </h3>
                <p className="text-gray-600 text-center max-w-md">
                  Drag and drop your dataset file here, or click to browse. Maximum file size: 4MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Progress */}
        {loading && (
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="font-medium text-gray-800">Analyzing your dataset...</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* Summary Card */}
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Dataset Summary</h2>
              <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Filter Tabs */}
            <div className="glass-card p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="analyzed">Analyzed ({analysis.issues.length})</TabsTrigger>
                  <TabsTrigger value="issues">
                    Issues ({analysis.issues.filter((i) => i.severity !== "Info").length})
                  </TabsTrigger>
                  <TabsTrigger value="recommendations">
                    Recommendations ({analysis.issues.filter((i) => i.recommendation).length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  <div className="grid gap-4">
                    {filteredIssues.map((issue, index) => (
                      <Card key={index} className="glass-border p-4">
                        <div className="flex items-start gap-4">
                          <div
                            className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: getSeverityColor(issue.severity) }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-800">{issue.column}</h4>
                              <Badge variant="outline" className="text-xs">
                                {issue.type}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ color: getSeverityColor(issue.severity) }}
                              >
                                {issue.severity}
                              </Badge>
                            </div>
                            <p className="text-gray-700 mb-2">{issue.description}</p>
                            <p className="text-sm text-gray-600 mb-3">{issue.explanation}</p>

                            {issue.recommendation && (
                              <div className="bg-blue-50 p-3 rounded-lg mb-3">
                                <p className="text-sm text-blue-800">{issue.recommendation}</p>
                              </div>
                            )}

                            <div className="flex items-center gap-4">
                              <div className="text-sm text-gray-600">
                                {issue.count.toLocaleString()} issues ({issue.percentage.toFixed(1)}%)
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateFix(issue)}
                                className="ml-auto"
                              >
                                <Code className="w-4 h-4 mr-2" />
                                Generate Fix
                              </Button>
                            </div>

                            {issue.fixCode && (
                              <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                                <pre className="text-sm text-green-400 overflow-x-auto">
                                  <code>{issue.fixCode}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
