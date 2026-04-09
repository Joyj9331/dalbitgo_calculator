import React, { useState } from 'react';
import Papa from 'papaparse';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useToast } from '../Toast';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

export function SalesDataImporter({ activeBrand }: { activeBrand: string | null }) {
  const toast = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'monthly' | 'daily'>('monthly');

  const processAndUpload = async (file: File) => {
    setIsUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const CHUNK_SIZE = 499; // Firestore max batch size is 500
          const records: any[] = [];

          if (uploadType === 'monthly') {
            const data = results.data as any[];
            for (const row of data) {
              if (!row['년-월'] || !row['총매출']) continue;
              const totalSalesStr = String(row['총매출']).replace(/,/g, '').trim();
              const totalSales = Number(totalSalesStr) || 0;
              records.push({
                brandId: activeBrand,
                yearMonth: String(row['년-월']).trim(),
                city: String(row['도시'] || '미분류').trim(),
                district: String(row['시군'] || '미분류').trim(),
                storeName: String(row['매장_요약'] || '').trim(),
                totalSales,
                createdAt: new Date().toISOString()
              });
            }
          } else {
            const data = results.data as any[];
            for (const row of data) {
              const dateStr = row['일자'] || Object.values(row)[0];
              const storeStr = row['영업매장'] || row['가맹점'] || Object.values(row)[1];
              const salesStr = row['총매출'] || Object.values(row)[2];
              if (!dateStr || dateStr === '일자' || !String(dateStr).includes('-')) continue;
              const cleanStoreStr = String(storeStr).replace('달빛에구운고등어', '').replace('(', '').replace(')', '').trim();
              const finalStoreName = cleanStoreStr.endsWith('점') || cleanStoreStr === '' ? cleanStoreStr : `${cleanStoreStr}점`;
              const cleanSalesStr = String(salesStr).replace(/,/g, '').trim();
              const totalSales = Number(cleanSalesStr) || 0;
              records.push({
                brandId: activeBrand,
                date: String(dateStr).trim(),
                storeName: finalStoreName.trim(),
                totalSales,
                createdAt: new Date().toISOString()
              });
            }
          }

          if (records.length === 0) {
            toast.error('유효한 데이터가 없거나 파일 양식이 맞지 않습니다.');
            setIsUploading(false);
            return;
          }

          // Chunk commits to stay within Firestore 500 ops/batch limit
          const collName = uploadType === 'monthly' ? 'monthly_sales' : 'daily_sales';
          for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const batch = writeBatch(db);
            records.slice(i, i + CHUNK_SIZE).forEach(r => {
              const ref = doc(collection(db, collName));
              batch.set(ref, { ...r, id: ref.id });
            });
            await batch.commit();
          }

          toast.success(`${records.length}건의 ${uploadType === 'monthly' ? '월별' : '일별'} 데이터가 성공적으로 저장되었습니다!`);
        } catch (err) {
          console.error(err);
          toast.error('데이터 저장 중 오류가 발생했습니다.');
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        toast.error(`CSV 파싱 오류: ${error.message}`);
        setIsUploading(false);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so same file can be re-uploaded
    e.target.value = '';
    if (!file) return;

    if (uploadType === 'daily') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headerIndex = lines.findIndex(l => l.includes('일자') && l.includes('영업매장'));
        const csvToParse = headerIndex > 0 ? lines.slice(headerIndex).join('\n') : text;
        Papa.parse(csvToParse, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => uploadParsedDailyData(results.data)
        });
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      processAndUpload(file);
    }
  };

  const uploadParsedDailyData = async (data: any[]) => {
    try {
      setIsUploading(true);
      const batch = writeBatch(db);
      let count = 0;

      for (const row of data) {
        const dateStr = row['일자'];
        const storeStr = row['영업매장'];
        const salesStr = row['총매출'];

        if (!dateStr || dateStr === '일자') continue;

        const cleanStoreStr = String(storeStr).replace('달빛에구운고등어', '').replace('(', '').replace(')', '').trim();
        const finalStoreName = cleanStoreStr.endsWith('점') || cleanStoreStr === '' ? cleanStoreStr : `${cleanStoreStr}점`;

        const cleanSalesStr = String(salesStr).replace(/,/g, '').trim();
        const totalSales = Number(cleanSalesStr) || 0;

        const recordRef = doc(collection(db, 'daily_sales'));
        batch.set(recordRef, {
          id: recordRef.id,
          brandId: activeBrand,
          date: String(dateStr).trim(),
          storeName: finalStoreName.trim(),
          totalSales,
          createdAt: new Date().toISOString()
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        toast.success(`${count}건의 일별 데이터가 성공적으로 저장되었습니다!`);
      } else {
        toast.error('유효한 데이터가 없거나 파일 양식이 맞지 않습니다.');
      }
    } catch (err) {
      console.error(err);
      toast.error('저장 중 오류 발생');
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <Upload className="h-12 w-12 mx-auto text-blue-500 mb-4" />
        
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">매출 데이터 업로드</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          CSV 파일을 업로드하면 데이터베이스에 저장되어 모든 구성원과 대시보드를 통해 실시간 공유됩니다.
        </p>

        <div className="flex gap-4 justify-center mt-6">
          <label className={`flex-1 cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${uploadType === 'monthly' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" name="uploadType" className="sr-only" checked={uploadType === 'monthly'} onChange={() => setUploadType('monthly')} />
            <FileSpreadsheet size={24} />
            <span className="font-medium">월별 데이터</span>
          </label>
          <label className={`flex-1 cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${uploadType === 'daily' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" name="uploadType" className="sr-only" checked={uploadType === 'daily'} onChange={() => setUploadType('daily')} />
            <FileSpreadsheet size={24} />
            <span className="font-medium">일별 데이터</span>
          </label>
        </div>

        <div className="relative mt-6">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <button
            disabled={isUploading}
            className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            {isUploading ? '업로드 중...' : 'CSV 파일 선택 및 업로드'}
          </button>
        </div>
        
      </div>
    </div>
  );
}
