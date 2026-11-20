import { describe, it, expect } from 'vitest'
import { describeEdits } from '../src/components/MyData.jsx'
import { editCourseRow, rowProvenance } from '../src/utils/provenance.js'

// Task 05 · readable audit lines for "My data" edits.
const before = [
  { code: 'CPIT-240', name: 'Databases (I)', grade: 'B', source: 'pdf' },
  { code: 'STAT-110', name: 'General Statistics (1)', grade: 'A', source: 'pdf' },
]
const keyed = rows => rows.map((row, key) => ({ ...row, key }))

describe('My data · describeEdits', () => {
  it('names a grade change, a deletion, an added row and a college change in plain language', () => {
    const rows = keyed(before)
    rows[0] = editCourseRow(rows[0], 'grade', 'F')
    rows[1] = { ...rows[1], deleted: true }
    rows.push({ code: 'CPIT-251', name: 'Software Engineering', grade: 'B', source: 'manual' })
    expect(describeEdits(before, rows, 'FCIT', 'SCI', 'ar')).toEqual([
      'CPIT-240: تغيير الدرجة من «B» إلى «F»',
      'حذف المقرر STAT-110',
      'إضافة المقرر CPIT-251 (أُدخل يدويًا)',
      'تغيير الكلية إلى كلية العلوم',
    ])
    expect(describeEdits(before, rows, 'FCIT', 'SCI', 'en')).toEqual([
      'CPIT-240: grade changed from “B” to “F”',
      'Deleted course STAT-110',
      'Added course CPIT-251 (typed by hand)',
      'College changed to Faculty of Science',
    ])
  })

  it('reports nothing when nothing changed, and keeps the extracted value through editCourseRow', () => {
    expect(describeEdits(before, keyed(before), 'FCIT', 'FCIT', 'en')).toEqual([])
    const edited = editCourseRow({ ...before[0] }, 'grade', 'A+')
    expect(edited.edits.grade).toBe('B')
    expect(rowProvenance(edited).gradeRaised).toBe(true)
    expect(describeEdits(before, keyed([edited, before[1]]), 'FCIT', 'FCIT', 'en')).toEqual(['CPIT-240: grade changed from “B” to “A+”'])
  })
})
