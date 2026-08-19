import React from 'react';

export default function RecurringTaskFields({
  isRecurring,
  setIsRecurring,
  recurringFrequency,
  setRecurringFrequency,
  recurringEndDate,
  setRecurringEndDate
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', gridColumn: '1 / -1', background: '#f8fafc' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        Set as Recurring Task
      </label>

      {isRecurring && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Frequency *</label>
            <select
              value={recurringFrequency || "Monthly"}
              onChange={(e) => setRecurringFrequency(e.target.value)}
              className="tm-form-select"
              required={isRecurring}
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>End Date (Optional)</label>
            <input
              type="date"
              value={recurringEndDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setRecurringEndDate(e.target.value)}
              className="tm-form-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
