// src/utils/generateServicePDF.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceApplication } from '../types';

export const generateServicePDF = (service: ServiceApplication) => {
    const doc = new jsPDF();

    // 1. Header
    doc.setFillColor(2, 12, 27); // Dark Blue Background (#000000)
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('RegiBIZ Application Summary', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Application ID: ${service.id}`, 14, 35);

    // 2. Application Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('Application Details', 14, 50);

    doc.setFontSize(11);
    doc.text(`Service Name: ${service.serviceName}`, 14, 60);
    doc.text(`Current Status: ${service.currentStatus.toUpperCase()}`, 14, 68);
    doc.text(`Applied On: ${new Date(service.createdAt).toLocaleDateString()}`, 14, 76);

    if (service.assignedAgent) {
        doc.text(`Assigned Agent: ${service.assignedAgent.name} (${service.assignedAgent.email})`, 14, 84);
    }

    // 3. Status History Table
    doc.setFontSize(16);
    doc.text('Status History', 14, 100);

    const historyData = (service.statusHistory || []).map(entry => [
        entry.status.replace('_', ' ').toUpperCase(),
        new Date(entry.timestamp).toLocaleString(),
        entry.note || '-'
    ]);

    autoTable(doc, {
        startY: 105,
        head: [['Status', 'Date & Time', 'Notes']],
        body: historyData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212], textColor: 255 }, // Cyan header
        alternateRowStyles: { fillColor: [240, 240, 240] },
    });

    // 4. Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('RegiBIZ Compliance Services - Confidential', 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, 190, doc.internal.pageSize.height - 10, { align: 'right' });
    }

    // 5. Save
    doc.save(`${service.serviceName.replace(/\s+/g, '_')}_Report.pdf`);
};
