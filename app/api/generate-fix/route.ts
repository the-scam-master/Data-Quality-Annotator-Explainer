import { type NextRequest, NextResponse } from "next/server"

interface DataIssue {
  column: string
  severity: string
  type: string
  description: string
  count: number
  percentage: number
}

function generateFixCode(issue: DataIssue, fileName: string): string {
  const fileExt = fileName.split(".").pop()?.toLowerCase()

  switch (issue.type) {
    case "Missing Values":
      if (fileExt === "csv") {
        return `# Fix missing values in ${issue.column}
import pandas as pd

# Load the dataset
df = pd.read_csv('${fileName}')

# Option 1: Fill with median (for numeric columns)
df['${issue.column}'].fillna(df['${issue.column}'].median(), inplace=True)

# Option 2: Fill with mode (for categorical columns)
# df['${issue.column}'].fillna(df['${issue.column}'].mode()[0], inplace=True)

# Option 3: Forward fill
# df['${issue.column}'].fillna(method='ffill', inplace=True)

# Save the cleaned dataset
df.to_csv('${fileName.replace(".csv", "_cleaned.csv")}', index=False)`
      } else {
        return `-- SQL fix for missing values in ${issue.column}
UPDATE your_table 
SET ${issue.column} = (
    SELECT AVG(${issue.column}) 
    FROM your_table 
    WHERE ${issue.column} IS NOT NULL
)
WHERE ${issue.column} IS NULL;`
      }

    case "Duplicate Values":
      if (fileExt === "csv") {
        return `# Remove duplicates based on ${issue.column}
import pandas as pd

# Load the dataset
df = pd.read_csv('${fileName}')

# Remove duplicates keeping the first occurrence
df_cleaned = df.drop_duplicates(subset=['${issue.column}'], keep='first')

# Save the cleaned dataset
df_cleaned.to_csv('${fileName.replace(".csv", "_deduped.csv")}', index=False)

print(f"Removed {len(df) - len(df_cleaned)} duplicate rows")`
      } else {
        return `-- SQL fix for duplicate values in ${issue.column}
WITH RankedData AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY ${issue.column} ORDER BY id) as rn
    FROM your_table
)
DELETE FROM your_table 
WHERE id IN (
    SELECT id FROM RankedData WHERE rn > 1
);`
      }

    case "Outliers":
      return `# Handle outliers in ${issue.column}
import pandas as pd
import numpy as np

# Load the dataset
df = pd.read_csv('${fileName}')

# Calculate IQR
Q1 = df['${issue.column}'].quantile(0.25)
Q3 = df['${issue.column}'].quantile(0.75)
IQR = Q3 - Q1

# Define outlier bounds
lower_bound = Q1 - 1.5 * IQR
upper_bound = Q3 + 1.5 * IQR

# Option 1: Cap outliers
df['${issue.column}'] = np.clip(df['${issue.column}'], lower_bound, upper_bound)

# Option 2: Remove outliers
# df = df[(df['${issue.column}'] >= lower_bound) & (df['${issue.column}'] <= upper_bound)]

# Save the cleaned dataset
df.to_csv('${fileName.replace(".csv", "_outliers_fixed.csv")}', index=False)`

    default:
      return `# Generic data cleaning for ${issue.column}
import pandas as pd

# Load the dataset
df = pd.read_csv('${fileName}')

# Inspect the column
print(df['${issue.column}'].describe())
print(df['${issue.column}'].value_counts())

# Apply appropriate cleaning based on your analysis
# df['${issue.column}'] = df['${issue.column}'].str.strip()  # Remove whitespace
# df['${issue.column}'] = df['${issue.column}'].str.lower()  # Normalize case

# Save the cleaned dataset
df.to_csv('${fileName.replace(".csv", "_cleaned.csv")}', index=False)`
  }
}

export async function POST(request: NextRequest) {
  try {
    const { issue, fileName } = await request.json()

    const fixCode = generateFixCode(issue, fileName)

    return NextResponse.json({ fixCode })
  } catch (error) {
    console.error("Fix generation error:", error)
    return NextResponse.json({ error: "Failed to generate fix" }, { status: 500 })
  }
}
