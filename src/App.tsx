import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, 
  ClipboardList, 
  Truck, 
  Download, 
  Plus, 
  Building2, 
  Calendar, 
  Image as ImageIcon, 
  PenSquare, 
  Trash2, 
  Search, 
  X, 
  Building, 
  CheckCircle2, 
  XCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Gauge,
  Weight,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  Mail,
  Lock,
  Database,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Carrier, LoadDetails, Tab } from './types';
import { supabase, hasSupabaseConfig } from './supabaseClient';

const US_STATES = [
  {abbr:'AL',name:'Alabama'},{abbr:'AK',name:'Alaska'},{abbr:'AZ',name:'Arizona'},
  {abbr:'AR',name:'Arkansas'},{abbr:'CA',name:'California'},{abbr:'CO',name:'Colorado'},
  {abbr:'CT',name:'Connecticut'},{abbr:'DE',name:'Delaware'},{abbr:'FL',name:'Florida'},
  {abbr:'GA',name:'Georgia'},{abbr:'HI',name:'Hawaii'},{abbr:'ID',name:'Idaho'},
  {abbr:'IL',name:'Illinois'},{abbr:'IN',name:'Indiana'},{abbr:'IA',name:'Iowa'},
  {abbr:'KS',name:'Kansas'},{abbr:'KY',name:'Kentucky'},{abbr:'LA',name:'Louisiana'},
  {abbr:'ME',name:'Maine'},{abbr:'MD',name:'Maryland'},{abbr:'MA',name:'Massachusetts'},
  {abbr:'MI',name:'Michigan'},{abbr:'MN',name:'Minnesota'},{abbr:'MS',name:'Mississippi'},
  {abbr:'MO',name:'Missouri'},{abbr:'MT',name:'Montana'},{abbr:'NE',name:'Nebraska'},
  {abbr:'NV',name:'Nevada'},{abbr:'NH',name:'New Hampshire'},{abbr:'NJ',name:'New Jersey'},
  {abbr:'NM',name:'New Mexico'},{abbr:'NY',name:'New York'},{abbr:'NC',name:'North Carolina'},
  {abbr:'ND',name:'North Dakota'},{abbr:'OH',name:'Ohio'},{abbr:'OK',name:'Oklahoma'},
  {abbr:'OR',name:'Oregon'},{abbr:'PA',name:'Pennsylvania'},{abbr:'RI',name:'Rhode Island'},
  {abbr:'SC',name:'South Carolina'},{abbr:'SD',name:'South Dakota'},{abbr:'TN',name:'Tennessee'},
  {abbr:'TX',name:'Texas'},{abbr:'UT',name:'Utah'},{abbr:'VT',name:'Vermont'},
  {abbr:'VA',name:'Virginia'},{abbr:'WA',name:'Washington'},{abbr:'WV',name:'West Virginia'},
  {abbr:'WI',name:'Wisconsin'},{abbr:'WY',name:'Wyoming'},{abbr:'DC',name:'District of Columbia'}
];

const getDisplayId = (incident: Carrier) => {
  if (incident.loadDetails?.mcNumber) {
    const mcDigits = incident.loadDetails.mcNumber.replace(/\D/g, '');
    if (mcDigits.length >= 4) {
      return `CAR-${mcDigits.substring(0, 4)}`;
    }
  }
  const match = incident.id.match(/\d{4,5}/);
  if (match) return `CAR-${match[0]}`;
  return `CAR-0000`;
};

const uploadTextRecord = async (record: Carrier, session: any) => {
   if (!session?.user) return null;
   let content = `CARRIER RECORD: ${getDisplayId(record)}\n`;
   content += `Dispatcher Name: ${record.dispatcherName}\n`;
   content += `Organization: ${record.organization}\n`;
   content += `Transfer Date: ${record.transferDate}\n`;
   content += `Time of Transfer: ${record.timeOfTransfer}\n`;
   content += `First Contact: ${record.timeOfFirstContact}\n`;
   content += `Marketer: ${record.marketerName || 'N/A'}\n`;
   content += `Status: ${record.status}\n`;
   content += `Explanation: ${record.explanation}\n\n`;
   
   if (record.loadDetails) {
     content += `LOAD DETAILS\n`;
     content += `MC Number: ${record.loadDetails.mcNumber}\n`;
     content += `DOT Number: ${record.loadDetails.dotNumber}\n`;
     content += `Vehicle: ${record.loadDetails.vehicleType} - ${record.loadDetails.vehicleSpecs}\n`;
     content += `Origin: ${record.loadDetails.originCity}, ${record.loadDetails.originState}\n`;
     content += `Dest: ${record.loadDetails.destCity}, ${record.loadDetails.destState}\n`;
     content += `Rate/Mile: $${record.loadDetails.ratePerMile}\n`;
     content += `Total Price: $${record.loadDetails.totalPrice}\n`;
     content += `Distance: ${record.loadDetails.distance} Miles\n`;
     content += `Weight: ${record.loadDetails.loadSize} lbs\n`;
     content += `Marketer: ${record.loadDetails.marketer}\n`;
     content += `Activation Status: ${record.loadDetails.wentActive}\n`;
   }
   
   content += `\n-- End of Document --\n`;
   const blob = new Blob([content], { type: 'text/plain' });
   const fileName = `${session.user.id}-${record.id}-record.txt`;
   
   try {
     const { error } = await supabase.storage.from('screenshots').upload(fileName, blob, { upsert: true });
     if (!error) {
       const { data } = supabase.storage.from('screenshots').getPublicUrl(fileName);
       return data.publicUrl;
     }
   } catch(err) {
     console.error('Failed to upload text log', err);
   }
   return null;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [incidents, setIncidents] = useState<Carrier[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('carriers');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'conversational'>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState(localStorage.getItem('saved_email') || '');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);

  const [vehicleFilter, setVehicleFilter] = useState<string>('All');

  // Incident Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dispatcherName: '',
    marketerName: '',
    organization: '',
    transferDate: '',
    timeOfTransfer: '',
    timeOfFirstContact: '',
    status: 'active' as const,
    explanation: '',
    screenshot: null as string | null
  });

  // Load Details Form State
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [ldData, setLdData] = useState<Partial<LoadDetails>>({
    vehicleType: '',
    vehicleSpecs: '',
    ratePerMile: '',
    wentActive: '',
    totalPrice: '',
    loadSize: '',
    distance: '',
    loadType: '',
    originState: '',
    originCity: '',
    destState: '',
    destCity: '',
    dispatcherBooked: '',
    marketer: '',
    mcNumber: '',
    dotNumber: ''
  });

  // Modals
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Setup Session & Theme
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const savedTheme = localStorage.getItem('ir_theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Supabase Data when session exists
  useEffect(() => {
    const fetchIncidents = async () => {
      if (!session?.user) return;
      try {
        const { data, error } = await supabase
          .from('incidents')
          .select('data')
          .eq('user_id', session.user.id);
          
        if (error) throw error;
        if (data) {
          setIncidents(
            data
              .map(row => row.data as Carrier)
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          );
        }
      } catch (err: any) {
        console.error('Fetch error: Check if `incidents` table exists', err);
      }
    };

    if (session?.user) {
      fetchIncidents();
    } else {
      setIncidents([]);
    }
  }, [session]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Allow paste anywhere since form is always visible
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             if (file.size > 5 * 1024 * 1024) {
               alert('Pasted file size exceeds 5MB limit.');
               return;
             }
             const reader = new FileReader();
             reader.onload = (ev) => {
                setFormData(p => ({...p, screenshot: ev.target?.result as string}));
             };
             reader.readAsDataURL(file);
             break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ir_theme', theme);
  }, [theme]);

  // Synapse Canvas Effect
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const NODE_COUNT = 55, MAX_DIST = 180, SPEED = 0.35;
    
    let nodes: any[] = [];
    const initNodes = () => {
      nodes = [];
      for(let i = 0; i < NODE_COUNT; i++){
        nodes.push({
          x: Math.random()*W, y: Math.random()*H,
          vx: (Math.random()-0.5)*SPEED, vy: (Math.random()-0.5)*SPEED,
          r: 2 + Math.random()*2.5,
          phase: Math.random()*Math.PI*2
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      const t = Date.now()/1000;
      for(let i = 0; i < nodes.length; i++){
        for(let j = i+1; j < nodes.length; j++){
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx*dx+dy*dy);
          if(dist < MAX_DIST){
            const alpha = (1 - dist/MAX_DIST) * 0.22;
            ctx.beginPath();
            ctx.strokeStyle = theme === 'dark' ? `rgba(255,107,0,${alpha})` : `rgba(230,92,0,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        const pulse = 0.5 + 0.5*Math.sin(t*1.2 + n.phase);
        const alpha = 0.18 + pulse*0.22;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
        ctx.fillStyle = theme === 'dark' ? `rgba(255,130,0,${alpha})` : `rgba(230,92,0,${alpha})`;
        ctx.fill();
        n.x += n.vx; n.y += n.vy;
        if(n.x < 0 || n.x > W) n.vx *= -1;
        if(n.y < 0 || n.y > H) n.vy *= -1;
      });
      requestAnimationFrame(draw);
    };

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initNodes();
    };

    window.addEventListener('resize', handleResize);
    initNodes();
    const animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [theme]);

  // Derived Stats
  const stats = useMemo(() => {
    const active = incidents.filter(i => i.status === 'active').length;
    const inactive = incidents.filter(i => i.status === 'inactive').length;
    const conversational = incidents.filter(i => i.status === 'conversational').length;
    const withLD = incidents.filter(i => i.loadDetails).length;
    const totalRevenue = incidents.reduce((acc, i) => acc + (parseFloat(i.loadDetails?.totalPrice || '0') || 0), 0);
    const withRate = incidents.filter(i => i.loadDetails && parseFloat(i.loadDetails.ratePerMile || '0') > 0 && (vehicleFilter === 'All' || i.loadDetails.vehicleType === vehicleFilter));
    const avgRate = withRate.length ? (withRate.reduce((acc, i) => acc + parseFloat(i.loadDetails!.ratePerMile || '0'), 0) / withRate.length) : 0;
    const vehicleTypesArray = Array.from(new Set(incidents.map(i => i.loadDetails?.vehicleType).filter(Boolean))) as string[];

    return { total: incidents.length, active, inactive, conversational, withLD, totalRevenue, avgRate, vehicleTypes: vehicleTypesArray };
  }, [incidents, vehicleFilter]);

  // Handlers
  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dispatcherName || !formData.organization || !formData.transferDate || !formData.marketerName || !formData.timeOfTransfer || !formData.timeOfFirstContact || !formData.explanation || !formData.screenshot) {
      alert('Please fill in all required fields, including adding an Evidence snapshot (Image or Document).');
      return;
    }
    
    if (!session?.user) {
      alert('You must be logged in to save.');
      return;
    }

    try {
      let screenshotUrl = formData.screenshot;
      
      // Upload Base64 image to Supabase Storage if it's a new file
      if (screenshotUrl && screenshotUrl.startsWith('data:image')) {
        const fileExt = screenshotUrl.split(';')[0].split('/')[1] || 'png';
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
        const res = await fetch(screenshotUrl);
        const blob = await res.blob();
        
        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, blob, { upsert: true });
          
        if (uploadError) {
          console.error(uploadError);
          alert('Failed to upload image. Ensure you created a public "screenshots" bucket in Supabase.');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('screenshots')
            .getPublicUrl(fileName);
          screenshotUrl = publicUrlData.publicUrl;
        }
      }

      let finalRecord: Carrier;
      if (editingId) {
        const updatedIncident = incidents.find(i => i.id === editingId);
        if (!updatedIncident) return;
        
        finalRecord = {
          ...updatedIncident,
          ...formData,
          screenshot: screenshotUrl,
          updatedAt: Date.now(),
          editCount: updatedIncident.editCount + 1
        };
      } else {
        const id = `CAR-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${Date.now()}`;
        finalRecord = {
          id,
          ...formData,
          screenshot: screenshotUrl,
          editCount: 0,
          createdAt: Date.now()
        };
      }

      // Automatically generate a document snapshot and upload it
      const docUrl = await uploadTextRecord(finalRecord, session);
      if (docUrl) {
         finalRecord.documentUrl = docUrl;
      }

      if (editingId) {
        const { error } = await supabase.from('incidents').update({
          data: finalRecord
        }).eq('id', editingId);

        if (error) throw error;
        setIncidents(prev => prev.map(i => i.id === editingId ? finalRecord : i));
        setEditingId(null);
      } else {
        const { error } = await supabase.from('incidents').insert({
          id: finalRecord.id,
          user_id: session.user.id,
          data: finalRecord
        });

        if (error) throw error;
        setIncidents(prev => [finalRecord, ...prev]);
      }

      setFormData({
        dispatcherName: '', marketerName: '', organization: '', transferDate: '',
        timeOfTransfer: '', timeOfFirstContact: '', status: 'active', explanation: '',
        screenshot: null
      });
      document.getElementById('form-top')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      alert('Failed to save. Ensure the "incidents" table exists in your Supabase project.');
    }
  };

  const handleLdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId || !session?.user) return;

    try {
      const selected = incidents.find(i => i.id === selectedIncidentId);
      if (!selected) return;

      const newRecord: Carrier = {
        ...selected,
        loadDetails: ldData as LoadDetails,
        updatedAt: Date.now(),
        editCount: selected.editCount + 1
      };

      const docUrl = await uploadTextRecord(newRecord, session);
      if (docUrl) {
         newRecord.documentUrl = docUrl;
      }

      const { error } = await supabase.from('incidents').update({
        data: newRecord
      }).eq('id', selectedIncidentId);

      if (error) throw error;

      setIncidents(prev => prev.map(i => i.id === selectedIncidentId ? newRecord : i));
      alert('Load details updated successfully.');
    } catch(err: any) {
      console.error(err);
      alert('Error updating load details in Supabase.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFormData(prev => ({ ...prev, screenshot: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    
    if (!hasSupabaseConfig) {
       alert('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
       setAuthLoading(false);
       return;
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        
        if (data.session === null) {
          alert('Signup successful! Please check your email (including spam) to confirm your account before logging in. If you did not receive an email, you may need to disable "Confirm email" in your Supabase dashboard.');
          setAuthMode('login');
        } else {
          // If session is not null, email confirmation is disabled and they are logged in!
          alert('Signup successful! You are now logged in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
      localStorage.setItem('saved_email', authEmail);
      setAuthPassword(''); // clear password on success
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthPassword('');
  };

  const handleInlineUpdate = async (id: string, updates: Partial<Carrier>) => {
    if (!session?.user) return;
    try {
      const existing = incidents.find(i => i.id === id);
      if (!existing) return;

      let finalScreenshots = updates.screenshots ? [...updates.screenshots] : (existing.screenshots ? [...existing.screenshots] : []);
      let finalScreenshot = updates.screenshot !== undefined ? updates.screenshot : existing.screenshot;

      if (finalScreenshots.length > 0) {
        for (let idx = 0; idx < finalScreenshots.length; idx++) {
           const screenInfo = finalScreenshots[idx];
           if (screenInfo && screenInfo.startsWith('data:image')) {
             const fileExt = screenInfo.split(';')[0].split('/')[1] || 'png';
             const fileName = `${session.user.id}-${Date.now()}-${idx}.${fileExt}`;
             const res = await fetch(screenInfo);
             const blob = await res.blob();
             
             const { error: uploadError } = await supabase.storage
               .from('screenshots')
               .upload(fileName, blob, { upsert: true });
               
             if (!uploadError) {
               const { data: publicUrlData } = supabase.storage
                 .from('screenshots')
                 .getPublicUrl(fileName);
               finalScreenshots[idx] = publicUrlData.publicUrl;
             }
           }
        }
      }

      const safeMainScreenshot = finalScreenshots.length > 0 ? finalScreenshots[0] : finalScreenshot;

      const newRecord = {
        ...existing,
        ...updates,
        screenshot: safeMainScreenshot,
        screenshots: finalScreenshots,
        updatedAt: Date.now(),
        editCount: existing.editCount + 1
      };

      const docUrl = await uploadTextRecord(newRecord as Carrier, session);
      if (docUrl) {
         newRecord.documentUrl = docUrl;
      }

      const { error } = await supabase.from('incidents').update({
        data: newRecord
      }).eq('id', id);

      if (error) throw error;
      setIncidents(prev => prev.map(i => i.id === id ? newRecord : i));
    } catch (err: any) {
      console.error(err);
      alert('Failed to update record inline.');
    }
  };

  const deleteIncident = async () => {
    if (deleteId && session?.user) {
      try {
        const { error } = await supabase.from('incidents').delete().eq('id', deleteId);
        if (error) throw error;
        
        setIncidents(prev => prev.filter(i => i.id !== deleteId));
        setDeleteId(null);
      } catch (err: any) {
        console.error(err);
        alert('Failed to delete from Supabase.');
      }
    }
  };

  const exportCSV = () => {
    const headers = [
      'ID','Dispatcher Name','Marketer','Organization','Transfer Date','Time of Transfer','First Contact','Status','Explanation','MC Number','DOT Number','Vehicle','Revenue'
    ];
    const rows = incidents.map(i => [
      i.id, i.dispatcherName, i.marketerName, i.organization, i.transferDate, i.timeOfTransfer, i.timeOfFirstContact, i.status, `"${i.explanation.replace(/"/g, '""')}"`,
      i.loadDetails?.mcNumber || '', i.loadDetails?.dotNumber || '', i.loadDetails?.vehicleType || '', i.loadDetails?.totalPrice || '0'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `carrier_registry_${Date.now()}.csv`;
    link.click();
  };

  const filteredIncidents = incidents.filter(i => {
    const matchesFilter = filter === 'all' || i.status === filter;
    const matchesSearch = 
      (i.dispatcherName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.explanation || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.marketerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.loadDetails?.mcNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.loadDetails?.dotNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.loadDetails?.destCity || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.loadDetails?.originCity || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.status || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const conversationalNeedsUpdate = incidents.filter(i => 
    i.status === 'conversational' && 
    (Date.now() - (i.updatedAt || i.createdAt)) > 2 * 24 * 60 * 60 * 1000
  );

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  useEffect(() => {
    if (selectedIncident?.loadDetails) {
      setLdData(selectedIncident.loadDetails);
    } else {
      setLdData({
        vehicleType: '',
        vehicleSpecs: '',
        ratePerMile: '',
        wentActive: '',
        totalPrice: '',
        loadSize: '',
        distance: '',
        loadType: '',
        originState: '',
        originCity: '',
        destState: '',
        destCity: '',
        dispatcherBooked: selectedIncident?.dispatcherName || '',
        marketer: '',
        mcNumber: '',
        dotNumber: ''
      });
    }
  }, [selectedIncidentId, selectedIncident]);

  if (!session) {
    return (
      <div className="relative min-h-screen text-white flex items-center justify-center p-6 font-sans">
        <canvas ref={canvasRef} className="fixed inset-0 z-[-1] pointer-events-none opacity-40 blur-md" />
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] overflow-hidden">
           <div className="bg-[var(--card2)] px-6 py-8 border-b border-[var(--border)] text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-[#FF8C33] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(255,107,0,0.35)]">
                 <ShieldCheck className="text-white w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Carrier Registry</h1>
              <p className="text-xs text-accent font-semibold tracking-wider uppercase mt-2">Exact Dispatcher LLC</p>
           </div>
           
           <form onSubmit={handleAuth} className="p-8">
              <h2 className="text-lg font-bold mb-6 text-center text-[var(--text)]">
                 {authMode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>

              {!hasSupabaseConfig && (
                 <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                    <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-red-400 font-bold mb-1">Missing Configuration</p>
                    <p className="text-xs text-red-300">You must add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the <b>Secrets panel</b> to enable authentication.</p>
                 </div>
              )}
              
              <div className="space-y-4 mb-8">
                 <FormGroup label="Email Address">
                    <div className="relative">
                       <input 
                          type="email" 
                          required
                          value={authEmail}
                          onChange={e => setAuthEmail(e.target.value)}
                          className="form-input bg-[var(--input-bg)] border-2 border-[var(--input-border)] rounded-lg w-full px-4 py-3 shadow-inner focus:border-accent outline-none text-sm" 
                          placeholder="you@email.com" 
                       />
                    </div>
                 </FormGroup>
                 <FormGroup label="Password">
                    <div className="relative">
                       <input 
                          type="password" 
                          required
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="form-input bg-[var(--input-bg)] border-2 border-[var(--input-border)] rounded-lg w-full px-4 py-3 shadow-inner focus:border-accent outline-none text-sm" 
                          placeholder="••••••••" 
                       />
                    </div>
                 </FormGroup>
              </div>

              <button 
                 type="submit" 
                 disabled={authLoading}
                 className="w-full py-3 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                 {authLoading ? 'Please Wait...' : (authMode === 'login' ? 'Secure Login' : 'Create Account')}
              </button>

              <div className="mt-6 text-center">
                 <button 
                    type="button" 
                    onClick={() => setAuthMode(m => m === 'login' ? 'signup' : 'login')}
                    className="text-xs text-[var(--text-muted)] hover:text-accent transition-colors font-semibold"
                 >
                    {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
                 </button>
              </div>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden font-sans">
      <canvas ref={canvasRef} className="fixed inset-0 z-[-1] pointer-events-none opacity-40 blur-md" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-[#FF8C33] rounded-xl flex items-center justify-center shadow-[0_0_12px_rgba(255,107,0,0.35)]">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">Carrier Registry</h1>
            <p className="text-[10px] text-accent font-semibold tracking-wider uppercase">Exact Dispatcher LLC</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('carriers')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'carriers' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]'}`}
          >
            <ClipboardList className="w-4 h-4" /> Carriers
          </button>
          <button 
            onClick={() => setActiveTab('loaddetails')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'loaddetails' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]'}`}
          >
            <Truck className="w-4 h-4" /> Load Details
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-2 border border-[var(--input-border)] rounded-lg hover:border-accent hover:text-accent transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={exportCSV} className="hidden sm:flex items-center gap-2 px-4 py-2 border border-[var(--input-border)] rounded-lg text-sm font-semibold hover:border-accent hover:text-accent transition-all text-[var(--text)]">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => document.getElementById('form-top')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-2 bg-gradient-to-br from-accent to-[#FF8C33] px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] transition-transform text-white">
            <Plus className="w-4 h-4" /> New
          </button>
          <button onClick={handleSignOut} className="p-2 border border-[var(--input-border)] rounded-lg hover:border-red-500 hover:text-red-500 transition-colors ml-2" title="Sign Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {conversationalNeedsUpdate.length > 0 && (
          <div className="mb-8 bg-[#FF8C33]/10 border border-[#FF8C33]/30 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-[#FF8C33] text-white p-2 rounded-lg">
              <LogOut className="w-5 h-5 rotate-[180deg]" /> {/* just an icon */}
            </div>
            <div>
              <h3 className="text-[#FF8C33] font-bold">Action Required</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                You have {conversationalNeedsUpdate.length} pending... 
                Please follow up to update their status.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                {conversationalNeedsUpdate.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => {
                       setDetailId(c.id);
                    }}
                    className="text-xs bg-[var(--card2)] border border-[var(--border)] px-3 py-1.5 rounded-md hover:border-accent transition-colors"
                  >
                    {c.dispatcherName || 'Unknown'} - {c.organization || 'No Org'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'carriers' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
              <StatCard icon={<ClipboardList />} label="Total Records" value={stats.total} />
              <StatCard icon={<CheckCircle2 />} label="Active" value={stats.active} color="text-green-500" />
              <StatCard icon={<XCircle />} label="Inactive" value={stats.inactive} color="text-red-500" />
              <StatCard icon={<MessageCircle />} label="Pending" value={stats.conversational} color="text-blue-500" />
            </div>

            {/* Form */}
            <section id="form-top" className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] overflow-hidden mb-8">
              <div className="bg-[var(--card2)] px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
                <div className="w-1 h-6 bg-accent rounded-full" />
                <h2 className="font-bold text-[var(--text)]">{editingId ? 'Edit' : 'Register'} Carrier</h2>
              </div>
              <form onSubmit={handleIncidentSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <FormGroup label="Dispatcher Name" required>
                    <input className="form-input w-full" type="text" required value={formData.dispatcherName} onChange={e => setFormData(p => ({...p, dispatcherName: e.target.value}))} placeholder="Dispatcher Name" />
                  </FormGroup>
                  <FormGroup label="Marketer Name" required>
                    <input className="form-input w-full" type="text" required value={formData.marketerName} onChange={e => setFormData(p => ({...p, marketerName: e.target.value}))} placeholder="Marketer Name" />
                  </FormGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <FormGroup label="Transfer Date" required>
                    <input className="form-input w-full" type="date" required value={formData.transferDate} onChange={e => setFormData(p => ({...p, transferDate: e.target.value}))} />
                  </FormGroup>
                  <FormGroup label="Status" required>
                    <select className="form-select w-full" required value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value as any}))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="conversational">Conversational</option>
                    </select>
                  </FormGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <FormGroup label="Time of Transfer" required>
                    <input className="form-input w-full" type="time" required value={formData.timeOfTransfer} onChange={e => setFormData(p => ({...p, timeOfTransfer: e.target.value}))} />
                  </FormGroup>
                  <FormGroup label="Time of First Contact" required>
                    <input className="form-input w-full" type="time" required value={formData.timeOfFirstContact} onChange={e => setFormData(p => ({...p, timeOfFirstContact: e.target.value}))} />
                  </FormGroup>
                </div>

                <div className="mb-6">
                  <FormGroup label="Organization" required>
                    <input className="form-input w-full" type="text" required value={formData.organization} onChange={e => setFormData(p => ({...p, organization: e.target.value}))} placeholder="Organization" />
                  </FormGroup>
                </div>

                <div className="mb-6">
                  <FormGroup label="Explanation (Min 20 chars)" required>
                    <textarea 
                      className="form-textarea w-full" 
                      required
                      rows={4} 
                      value={formData.explanation} 
                      onChange={e => setFormData(p => ({...p, explanation: e.target.value}))}
                      placeholder="Detail the carrier record..."
                    />
                    <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">{formData.explanation.length}/2000</div>
                  </FormGroup>
                </div>

                <div className="mb-6">
                   <FormGroup label="Evidence (Images/Docs)" required>
                    <div 
                      onClick={() => document.getElementById('screenshot-upload')?.click()}
                      className="border-2 border-dashed border-[var(--input-border)] rounded-xl py-8 flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group"
                    >
                      <input type="file" id="screenshot-upload" className="hidden" accept="image/*,.txt,.pdf,.doc,.docx" onChange={handleFileChange} />
                      {formData.screenshot ? (
                        <div className="relative group">
                          {formData.screenshot.includes('application/') || formData.screenshot.includes('text/') || formData.screenshot.includes('.pdf') || formData.screenshot.includes('.txt') ? (
                             <div className="w-48 h-32 bg-[var(--card2)] rounded flex flex-col items-center justify-center border border-[var(--border)]">
                                <span className="font-bold text-accent text-sm break-all">DOCUMENT ATTACHED</span>
                             </div>
                          ) : (
                             <img src={formData.screenshot} className="max-h-48 rounded-lg shadow-lg" alt="Preview" />
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setFormData(p => ({...p, screenshot: null})) }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-10 h-10 text-[var(--text-muted)] mb-2 group-hover:text-accent transition-colors" />
                          <p className="text-sm text-[var(--text-muted)]">Drop image here or click to upload</p>
                          <p className="text-[10px] text-[var(--text-muted)] opacity-50 mt-1">PNG, JPG up to 5MB</p>
                        </>
                      )}
                    </div>
                   </FormGroup>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setEditingId(null); setFormData({dispatcherName:'', organization:'', transferDate:'', timeOfTransfer:'', timeOfFirstContact:'', status:'active', explanation:'', screenshot:null})}} className="px-6 py-2 border border-[var(--input-border)] rounded-lg text-sm font-semibold hover:bg-white/5 transition-all text-[var(--text)]">
                    Reset
                  </button>
                  <button type="submit" className="px-8 py-2 bg-accent text-white rounded-lg text-sm font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    {editingId ? 'Update Record' : 'Save Result'}
                  </button>
                </div>
              </form>
            </section>

            {/* Records List */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] overflow-hidden">
               <div className="bg-[var(--card2)] px-6 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-accent rounded-full" />
                    <h2 className="font-bold text-[var(--text)] whitespace-nowrap">Recent Carriers</h2>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-[var(--input-bg)] p-1 rounded-lg border border-[var(--input-border)] shrink-0">
                       <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 flex items-center gap-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'kanban' ? 'bg-accent text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                          Kanban
                       </button>
                       <button onClick={() => setViewMode('list')} className={`px-3 py-1 flex items-center gap-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'list' ? 'bg-accent text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                          List
                       </button>
                    </div>
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none z-10" />
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        placeholder="Search..." 
                        className="w-[200px] bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg pl-9 pr-4 py-1.5 text-sm focus:border-accent outline-none" 
                      />
                    </div>
                    <div className="flex bg-[var(--input-bg)] p-1 rounded-lg border border-[var(--input-border)] shrink-0">
                      {(['all', 'active', 'inactive', 'conversational'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md text-[10px] whitespace-nowrap font-bold uppercase tracking-wider transition-all ${filter === f ? 'bg-accent text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                          {f === 'conversational' ? 'pending' : f}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>

               <div className="border-t border-[var(--border)]">
                 {viewMode === 'list' ? (
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-[#111] text-[#777] uppercase text-[10px] tracking-wider border-b border-[var(--border)]">
                         <tr>
                           <th className="px-6 py-4 font-bold">ID / Actions</th>
                           <th className="px-6 py-4 font-bold">Dispatcher</th>
                           <th className="px-6 py-4 font-bold">Organization</th>
                           <th className="px-6 py-4 font-bold">Status</th>
                           <th className="px-6 py-4 font-bold">Transfer Date</th>
                           <th className="px-6 py-4 font-bold">Marketer</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-[var(--border)]">
                         {filteredIncidents.length > 0 ? filteredIncidents.map(inc => (
                           <IncidentTableRow 
                             key={inc.id} 
                             incident={inc} 
                             onDetail={() => setDetailId(inc.id)}
                             onUpdate={handleInlineUpdate}
                           />
                         )) : (
                           <tr>
                             <td colSpan={6} className="py-20 text-center">
                               <ClipboardList className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                               <p className="text-[var(--text-muted)] font-medium">No records found matching your workspace</p>
                             </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                 ) : (
                   <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                     {filteredIncidents.length > 0 ? filteredIncidents.map(inc => (
                        <IncidentCard 
                          key={inc.id} 
                          incident={inc} 
                          onDetail={() => setDetailId(inc.id)}
                          onUpdate={handleInlineUpdate}
                        />
                     )) : (
                       <div className="col-span-full py-20 text-center">
                         <ClipboardList className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                         <p className="text-[var(--text-muted)] font-medium">No records found matching your workspace</p>
                       </div>
                     )}
                   </div>
                 )}
               </div>
            </div>
          </motion.div>
        )}

        {/* Load Details Tab */}
        {activeTab === 'loaddetails' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <StatCard icon={<Truck />} label="Verified Loads" value={stats.withLD} />
              <StatCard icon={<DollarSign />} label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="text-yellow-500" />
              <StatCard 
                icon={<Gauge />} 
                label="Avg. Rate/Mile" 
                value={`$${stats.avgRate.toFixed(2)}`} 
                color="text-blue-500" 
                extra={
                  <select 
                    className="bg-[var(--input-bg)] border border-[var(--border)] rounded text-[9px] px-1 py-0.5 outline-none focus:border-accent text-[var(--text)] ml-auto cursor-pointer"
                    value={vehicleFilter}
                    onChange={(e) => setVehicleFilter(e.target.value)}
                  >
                    <option value="All">All Types</option>
                    {stats.vehicleTypes.map(vt => <option key={vt} value={vt}>{vt}</option>)}
                  </select>
                }
              />
            </div>

            <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] overflow-hidden mb-8">
               <div className="bg-[var(--card2)] px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
                  <div className="w-1 h-6 bg-accent rounded-full" />
                  <h2 className="font-bold text-[var(--text)]">Market Intelligence / Load Detail</h2>
               </div>
               <div className="p-6">
                  <div className="mb-6 max-w-md">
                    <FormGroup label="Select Carrier Record">
                      <select className="form-select w-full" value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)}>
                        <option value="">Choose a record...</option>
                        {incidents.map(i => (
                          <option key={i.id} value={i.id}>{i.id} — {i.dispatcherName} ({i.organization})</option>
                        ))}
                      </select>
                    </FormGroup>
                  </div>

                  {selectedIncidentId ? (
                    <form onSubmit={handleLdSubmit}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <FormGroup label="MC Number">
                           <input className="form-input w-full" type="text" value={ldData.mcNumber} onChange={e => setLdData(p => ({...p, mcNumber: e.target.value}))} placeholder="MC#" />
                        </FormGroup>
                        <FormGroup label="DOT Number">
                           <input className="form-input w-full" type="text" value={ldData.dotNumber} onChange={e => setLdData(p => ({...p, dotNumber: e.target.value}))} placeholder="DOT#" />
                        </FormGroup>
                        <FormGroup label="Vehicle Type">
                          <select className="form-select w-full" value={ldData.vehicleType} onChange={e => setLdData(p => ({...p, vehicleType: e.target.value}))}>
                            <option value="">Select...</option>
                            <option value="Dry Van">Dry Van</option>
                            <option value="Reefer">Reefer</option>
                            <option value="Flatbed">Flatbed</option>
                            <option value="Step Deck">Step Deck</option>
                            <option value="Hotshot">Hotshot</option>
                            <option value="Box Truck">Box Truck</option>
                          </select>
                        </FormGroup>
                        <FormGroup label="Specs">
                           <input className="form-input w-full" type="text" value={ldData.vehicleSpecs} onChange={e => setLdData(p => ({...p, vehicleSpecs: e.target.value}))} placeholder="e.g. 53ft Air Ride" />
                        </FormGroup>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <FormGroup label="Rate Per Mile">
                           <input className="form-input w-full" type="number" step="0.01" value={ldData.ratePerMile} onChange={e => setLdData(p => ({...p, ratePerMile: e.target.value}))} placeholder="0.00" />
                        </FormGroup>
                        <FormGroup label="Distance (Miles)">
                           <input className="form-input w-full" type="number" value={ldData.distance} onChange={e => setLdData(p => ({...p, distance: e.target.value}))} placeholder="0" />
                        </FormGroup>
                        <FormGroup label="Total Price Paid">
                           <input className="form-input w-full" type="number" step="0.01" value={ldData.totalPrice} onChange={e => setLdData(p => ({...p, totalPrice: e.target.value}))} placeholder="0.00" />
                        </FormGroup>
                         <FormGroup label="Load Weight (lbs)">
                           <input className="form-input w-full" type="number" value={ldData.loadSize} onChange={e => setLdData(p => ({...p, loadSize: e.target.value}))} placeholder="0" />
                        </FormGroup>
                      </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <FormGroup label="Origin City">
                           <input className="form-input w-full" type="text" value={ldData.originCity} onChange={e => setLdData(p => ({...p, originCity: e.target.value}))} placeholder="City" />
                        </FormGroup>
                        <FormGroup label="Origin State">
                           <select className="form-select w-full" value={ldData.originState} onChange={e => setLdData(p => ({...p, originState: e.target.value}))}>
                              <option value="">State...</option>
                              {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr}</option>)}
                           </select>
                        </FormGroup>
                        <FormGroup label="Dest. City">
                           <input className="form-input w-full" type="text" value={ldData.destCity} onChange={e => setLdData(p => ({...p, destCity: e.target.value}))} placeholder="City" />
                        </FormGroup>
                        <FormGroup label="Dest. State">
                           <select className="form-select w-full" value={ldData.destState} onChange={e => setLdData(p => ({...p, destState: e.target.value}))}>
                              <option value="">State...</option>
                              {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr}</option>)}
                           </select>
                        </FormGroup>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                         <FormGroup label="Load Type">
                          <select className="form-select w-full" value={ldData.loadType} onChange={e => setLdData(p => ({...p, loadType: e.target.value}))}>
                            <option value="">Select...</option>
                            <option value="FTL">FTL (Full Truckload)</option>
                            <option value="LTL">LTL (Less Than Truckload)</option>
                            <option value="Partial">Partial</option>
                          </select>
                        </FormGroup>
                        <FormGroup label="Dispatcher Booked">
                           <input className="form-input w-full" type="text" value={ldData.dispatcherBooked} onChange={e => setLdData(p => ({...p, dispatcherBooked: e.target.value}))} />
                        </FormGroup>
                        <FormGroup label="Marketer">
                           <input className="form-input w-full" type="text" value={ldData.marketer} onChange={e => setLdData(p => ({...p, marketer: e.target.value}))} placeholder="Name" />
                        </FormGroup>
                        <FormGroup label="Activation Status">
                          <select className="form-input w-full" value={ldData.wentActive} onChange={e => setLdData(p => ({...p, wentActive: e.target.value}))}>
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </FormGroup>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)]">
                        <button type="submit" className="px-8 py-3 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                          Update Market Intelligence
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="py-20 text-center bg-white/5 rounded-xl border border-dashed border-[var(--input-border)]">
                      <Truck className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                      <p className="text-[var(--text-muted)]">Select a carrier to overlay load data</p>
                    </div>
                  )}
               </div>
            </section>
          </motion.div>
        )}
      </main>

      <footer className="mt-20 text-center py-10 border-t border-[var(--border)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-[0.2em]">
        Carrier Management &copy; 2024 Exact Dispatcher LLC &bull; Advanced Registry System
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {detailId && (
          <Modal onClose={() => setDetailId(null)} title={getDisplayId(incidents.find(i => i.id === detailId)!)}>
            <DetailContent 
              incident={incidents.find(i => i.id === detailId)!} 
              onEdit={() => { /* Not used anymore since edit is inline, but kept for signature */ }}
              onDelete={() => { setDeleteId(detailId); setDetailId(null); }}
              onAddLd={() => { setSelectedIncidentId(detailId); setDetailId(null); setActiveTab('loaddetails'); }}
              onZoom={(src) => setLightboxImg(src)}
              onUpdate={handleInlineUpdate}
            />
          </Modal>
        )}
        
        {deleteId && (
          <Modal onClose={() => setDeleteId(null)} title="Destructive Action">
            <div className="p-8 text-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Delete Carrier?</h3>
              <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">
                This will permanently remove the record from the registry. This action cannot be reversed.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-6 py-3 border border-[var(--input-border)] rounded-xl font-bold">Cancel</button>
                <button onClick={deleteIncident} className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold">Confirm Delete</button>
              </div>
            </div>
          </Modal>
        )}

        {lightboxImg && (
          <div 
            className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightboxImg(null)}
          >
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={lightboxImg} 
              className="max-w-full max-h-full object-contain rounded-lg" 
              alt="Snapshot" 
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Components

function StatCard({ icon, label, value, color = "text-accent", extra }: { icon: any, label: string, value: any, color?: string, extra?: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow)] flex items-center gap-4 hover:translate-y-[-4px] transition-all group relative overflow-hidden">
      <div className={`w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center ${color} group-hover:scale-110 transition-transform shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">{label}</p>
          {extra}
        </div>
        <p className="text-3xl font-black text-[var(--text)] tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
}

function FormGroup({ label, required, children }: { label: string, required?: boolean, children: any }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function IncidentCard({ incident, onDetail, onUpdate }: { incident: Carrier, onDetail: () => void, onUpdate?: (id: string, updates: Partial<Carrier>) => Promise<void>, key?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(incident);
  const [isSaving, setIsSaving] = useState(false);

  const badgeColors = incident.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/30' : incident.status === 'inactive' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-blue-500/10 text-blue-500 border-blue-500/30';
  
  if (isEditing) {
    return (
      <div className={`bg-[var(--card2)] border border-accent rounded-xl p-5 shadow-xl relative overflow-hidden group ${incident.loadDetails ? 'border-l-4 border-l-accent' : ''}`}>
        <div className="text-[10px] font-mono text-accent font-bold mb-2">{getDisplayId(incident)}</div>
        
        <input 
          autoFocus
          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-lg font-bold px-2 py-1 mb-2 focus:border-accent outline-none text-[var(--text)] transition-colors"
          value={editForm.dispatcherName}
          onChange={e => setEditForm(p => ({...p, dispatcherName: e.target.value}))}
          placeholder="Dispatcher Name"
        />

        <div className="flex items-center gap-2 mb-4">
          <select 
            className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-[10px] font-bold uppercase tracking-wider px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
            value={editForm.status}
            onChange={e => setEditForm(p => ({...p, status: e.target.value as any}))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="conversational">Conversational</option>
          </select>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <Building className="w-3 h-3 text-[var(--text-muted)] shrink-0" /> 
            <input 
              className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
              value={editForm.organization}
              onChange={e => setEditForm(p => ({...p, organization: e.target.value}))}
              placeholder="Organization"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3 h-3 text-[var(--text-muted)] shrink-0" /> 
            <input 
              type="date"
              className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
              value={editForm.transferDate}
              onChange={e => setEditForm(p => ({...p, transferDate: e.target.value}))}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <TrendingDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" /> 
            <input 
               className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
               value={editForm.marketerName || ''}
               onChange={e => setEditForm(p => ({...p, marketerName: e.target.value}))}
               placeholder="Marketer Name"
             />
          </div>
        </div>

        <textarea 
          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 text-xs outline-none focus:border-accent mb-4 min-h-[60px] text-[var(--text)] transition-colors resize-y"
          value={editForm.explanation}
          onChange={e => setEditForm(p => ({...p, explanation: e.target.value}))}
          placeholder="Explanation..."
        />

        <div className="flex items-center gap-2 mt-2">
          <button 
            disabled={isSaving}
            onClick={async (e) => {
              e.stopPropagation();
              setIsSaving(true);
              if (onUpdate) await onUpdate(incident.id, editForm);
              setIsSaving(false);
              setIsEditing(false);
            }} 
            className="flex-1 bg-accent text-white py-1.5 rounded-lg text-xs font-bold shadow-lg disabled:opacity-50 hover:bg-accent-hover transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button 
            disabled={isSaving}
            onClick={(e) => {
              e.stopPropagation();
              setEditForm(incident);
              setIsEditing(false);
            }} 
            className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] py-1.5 rounded-lg text-xs font-bold hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      onClick={onDetail}
      className={`bg-[var(--card2)] border border-[var(--border)] rounded-xl p-5 cursor-pointer hover:shadow-xl hover:shadow-accent/5 transition-all relative overflow-hidden group ${incident.loadDetails ? 'border-l-4 border-l-accent' : ''}`}
    >
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
            setEditForm(incident);
          }}
          className="p-1.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-lg hover:border-accent hover:text-accent transition-colors shadow-sm"
          title="Edit Inline"
        >
          <PenSquare className="w-4 h-4 text-[var(--text-muted)] hover:text-accent transition-colors" />
        </button>
      </div>

      <div className="text-[10px] font-mono text-accent font-bold mb-2 pr-10">{getDisplayId(incident)}</div>
      <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-colors pr-10">{incident.dispatcherName}</h3>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badgeColors}`}>{incident.status === 'conversational' ? 'pending' : incident.status}</span>
        {incident.loadDetails && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-accent/30 bg-accent/10 text-accent flex items-center gap-1"><Truck className="w-2 h-2" /> Loaded</span>}
        {incident.editCount > 0 && <span className="text-[9px] text-[var(--text-muted)] font-bold italic">{incident.editCount} edit{incident.editCount !== 1 ? 's' : ''}</span>}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Building className="w-3 h-3 shrink-0" /> {incident.organization}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Calendar className="w-3 h-3 shrink-0" /> {new Date(incident.transferDate).toLocaleDateString()}
        </div>
        {incident.marketerName && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <TrendingDown className="w-3 h-3 shrink-0" /> Marketer: {incident.marketerName}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed h-8">
        {incident.explanation}
      </p>

      <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          {incident.screenshot && <ImageIcon className="w-3 h-3 text-accent" />}
        </div>
        <span className="text-[10px] text-[var(--text-muted)] opacity-50">
          {new Date(incident.createdAt).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}

function IncidentTableRow({ incident, onDetail, onUpdate }: { incident: Carrier, onDetail: () => void, onUpdate?: (id: string, updates: Partial<Carrier>) => Promise<void>, key?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(incident);
  const [isSaving, setIsSaving] = useState(false);

  const badgeColors = incident.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/30' : incident.status === 'inactive' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-blue-500/10 text-blue-500 border-blue-500/30';
  
  if (isEditing) {
    return (
      <tr className="bg-[var(--card2)]">
        <td className="px-6 py-4">
          <div className="text-[10px] font-mono text-accent font-bold mb-2">{getDisplayId(incident)}</div>
          <div className="flex gap-2">
            <button 
              disabled={isSaving}
              onClick={async (e) => {
                e.stopPropagation();
                setIsSaving(true);
                if (onUpdate) await onUpdate(incident.id, editForm);
                setIsSaving(false);
                setIsEditing(false);
              }} 
              className="px-3 py-1 bg-accent text-white rounded text-xs font-bold disabled:opacity-50 hover:bg-accent-hover transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button 
              disabled={isSaving}
              onClick={(e) => {
                e.stopPropagation();
                setEditForm(incident);
                setIsEditing(false);
              }} 
              className="px-3 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] rounded text-xs font-bold hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </td>
        <td className="px-6 py-4">
          <input 
            autoFocus
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
            value={editForm.dispatcherName}
            onChange={e => setEditForm(p => ({...p, dispatcherName: e.target.value}))}
            placeholder="Dispatcher Name"
          />
        </td>
        <td className="px-6 py-4">
          <input 
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
            value={editForm.organization}
            onChange={e => setEditForm(p => ({...p, organization: e.target.value}))}
            placeholder="Organization"
          />
        </td>
        <td className="px-6 py-4">
          <select 
            className="bg-[var(--input-bg)] w-full border border-[var(--input-border)] rounded text-[10px] font-bold uppercase tracking-wider px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
            value={editForm.status}
            onChange={e => setEditForm(p => ({...p, status: e.target.value as any}))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="conversational">Conversational</option>
          </select>
        </td>
        <td className="px-6 py-4">
          <input 
            type="date"
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
            value={editForm.transferDate}
            onChange={e => setEditForm(p => ({...p, transferDate: e.target.value}))}
          />
        </td>
        <td className="px-6 py-4">
          <input 
             className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm px-2 py-1 outline-none focus:border-accent text-[var(--text)] transition-colors"
             value={editForm.marketerName || ''}
             onChange={e => setEditForm(p => ({...p, marketerName: e.target.value}))}
             placeholder="Marketer Name"
           />
        </td>
      </tr>
    );
  }

  return (
    <tr 
      onClick={onDetail}
      className="hover:bg-[var(--card2)] cursor-pointer transition-colors group"
    >
      <td className="px-6 py-4 relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditForm(incident);
            }}
            className="p-1.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-lg hover:border-accent hover:text-accent transition-colors shadow-sm"
            title="Edit Inline"
          >
            <PenSquare className="w-4 h-4 text-[var(--text-muted)] hover:text-accent transition-colors" />
          </button>
        </div>
        <div className="text-[10px] font-mono text-accent font-bold group-hover:ml-8 transition-all">{getDisplayId(incident)}</div>
        {incident.loadDetails && <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-accent/30 bg-accent/10 text-accent flex items-center gap-1 w-max"><Truck className="w-2 h-2" /> Loaded</span>}
      </td>
      <td className="px-6 py-4">
        <div className="font-bold text-[var(--text)]">{incident.dispatcherName}</div>
        {incident.editCount > 0 && <div className="text-[9px] text-[var(--text-muted)] font-bold italic mt-1">{incident.editCount} edit{incident.editCount !== 1 ? 's' : ''}</div>}
      </td>
      <td className="px-6 py-4 text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Building className="w-3 h-3 shrink-0" /> {incident.organization}
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badgeColors}`}>
          {incident.status === 'conversational' ? 'pending' : incident.status}
        </span>
      </td>
      <td className="px-6 py-4 text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 shrink-0" /> {new Date(incident.transferDate).toLocaleDateString()}
        </div>
      </td>
      <td className="px-6 py-4 text-[var(--text-muted)]">
        {incident.marketerName ? (
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3 h-3 shrink-0" /> {incident.marketerName}
          </div>
        ) : '-'}
      </td>
    </tr>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void, title: string, children: any }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10"
      >
        <div className="bg-[var(--card2)] h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
          <h2 className="font-mono text-xs font-bold text-accent uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-3.5rem)]">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function DetailContent({ incident, onEdit, onDelete, onAddLd, onZoom, onUpdate }: { incident: Carrier, onEdit: () => void, onDelete: () => void, onAddLd: () => void, onZoom: (src: string) => void, onUpdate?: (id: string, updates: Partial<Carrier>) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Carrier>>(incident);
  const [isSaving, setIsSaving] = useState(false);
  const ld = incident.loadDetails;
  const badgeColors = incident.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/30' : incident.status === 'inactive' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-blue-500/10 text-blue-500 border-blue-500/30';
  
  if (isEditing) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="w-full mr-4 space-y-3">
             <input autoFocus className="form-input text-2xl font-bold bg-transparent border-b-2 border-[var(--border)] border-t-0 border-l-0 border-r-0 !rounded-none focus:border-accent w-full px-0 py-1" value={editForm.dispatcherName || ''} onChange={e => setEditForm(p => ({...p, dispatcherName: e.target.value}))} placeholder="Dispatcher Name" />
             <input className="form-input text-xs font-bold uppercase tracking-widest text-accent bg-transparent border-b-2 border-[var(--border)] border-t-0 border-l-0 border-r-0 !rounded-none focus:border-accent w-full px-0 py-1" value={editForm.organization || ''} onChange={e => setEditForm(p => ({...p, organization: e.target.value}))} placeholder="Organization" />
          </div>
          <div className="text-right">
             <select className="form-select text-[10px] font-black uppercase text-center border-accent/30 py-2 min-w-[120px]" value={editForm.status} onChange={e => setEditForm(p => ({...p, status: e.target.value as any}))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="conversational">Conversational</option>
             </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
           <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">Marketer</p>
              <input className="form-input text-sm font-bold bg-[var(--input-bg)] focus:border-accent w-full py-1" value={editForm.marketerName || ''} onChange={e => setEditForm(p => ({...p, marketerName: e.target.value}))} placeholder="N/A" />
           </div>
           <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">Transfer Date</p>
              <input type="date" className="form-input text-sm font-bold bg-[var(--input-bg)] focus:border-accent w-full py-1" value={editForm.transferDate || ''} onChange={e => setEditForm(p => ({...p, transferDate: e.target.value}))} />
           </div>
           <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">Time Transferred</p>
              <input type="time" className="form-input text-sm font-bold bg-[var(--input-bg)] focus:border-accent w-full py-1" value={editForm.timeOfTransfer || ''} onChange={e => setEditForm(p => ({...p, timeOfTransfer: e.target.value}))} />
           </div>
           <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">First Contact</p>
              <input type="time" className="form-input text-sm font-bold bg-[var(--input-bg)] focus:border-accent w-full py-1" value={editForm.timeOfFirstContact || ''} onChange={e => setEditForm(p => ({...p, timeOfFirstContact: e.target.value}))} />
           </div>
        </div>

        <div className="mb-10">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Carrier Explanation</h4>
          <textarea className="form-textarea w-full bg-[var(--card2)] resize-y min-h-[120px] mb-6" value={editForm.explanation || ''} onChange={e => setEditForm(p => ({...p, explanation: e.target.value}))}></textarea>
          
          <div className="flex items-center justify-between mb-3">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Evidence Snapshots</h4>
             <button onClick={() => document.getElementById(`inline-screenshot-upload-${incident.id}`)?.click()} className="text-accent hover:text-accent-hover text-xs font-bold flex items-center gap-1">
               <Plus className="w-3 h-3" /> Add Image/Doc
             </button>
             <input 
               type="file" 
               id={`inline-screenshot-upload-${incident.id}`} 
               className="hidden" 
               accept="image/*,.txt,.pdf,.doc,.docx" 
               multiple
               onChange={(e) => {
                 const files = Array.from(e.target.files || []) as File[];
                 if (files.length === 0) return;
                 const newScreenshots: string[] = [];
                 let loaded = 0;
                 files.forEach(file => {
                   const reader = new FileReader();
                   reader.onload = (ev) => {
                     if (ev.target?.result) newScreenshots.push(ev.target.result as string);
                     loaded++;
                     if (loaded === files.length) {
                       setEditForm(p => {
                         const current = p.screenshots ? [...p.screenshots] : [];
                         if (p.screenshot && current.length === 0) current.push(p.screenshot);
                         return {
                           ...p, 
                           screenshots: [...current, ...newScreenshots],
                           screenshot: p.screenshot || newScreenshots[0]
                         };
                       });
                     }
                   };
                   reader.readAsDataURL(file);
                 });
               }} 
             />
          </div>
          
          {((editForm.screenshots && editForm.screenshots.length > 0) || editForm.screenshot) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               {(() => {
                 const imgs = [...(editForm.screenshots || [])];
                 if (editForm.screenshot && !imgs.includes(editForm.screenshot)) imgs.unshift(editForm.screenshot);
                 
                 return imgs.map((img, idx) => (
                   <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--border)] shadow-md">
                     {img.includes('application/') || img.includes('text/') || img.includes('.pdf') || img.includes('.txt') ? (
                       <div className="w-full h-32 bg-[var(--card2)] flex items-center justify-center border-b border-[var(--border)]">
                          <span className="text-xs font-bold text-accent">DOCUMENT</span>
                       </div>
                     ) : (
                       <img src={img} className="w-full h-32 object-cover" alt="Evidence" />
                     )}
                     <button onClick={() => {
                        const newImgs = imgs.filter((_, i) => i !== idx);
                        setEditForm(p => ({
                          ...p, 
                          screenshots: newImgs,
                          screenshot: newImgs.length > 0 ? newImgs[0] : null
                        }));
                     }} className="absolute top-1 right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg text-white">
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                 ));
               })()}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 pt-8 border-t border-[var(--border)]">
          <button disabled={isSaving} onClick={async () => {
             setIsSaving(true);
             if (onUpdate) await onUpdate(incident.id, editForm);
             setIsSaving(false);
             setIsEditing(false);
          }} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold shadow-[var(--glow)] hover:bg-accent-hover transition-all">
             {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button disabled={isSaving} onClick={() => { setEditForm(incident); setIsEditing(false); }} className="px-6 py-3 border border-[var(--input-border)] rounded-xl font-bold hover:bg-white/5 transition-all text-[var(--text)]">
             Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold mb-1">{incident.dispatcherName}</h3>
          <p className="text-accent text-xs font-bold uppercase tracking-widest">{incident.organization}</p>
        </div>
        <div className="text-right">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-center border ${badgeColors}`}>
            {incident.status === 'conversational' ? 'pending' : incident.status}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-2 font-mono">EDIT COUNT: {incident.editCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <DetailInfo label="Marketer" value={incident.marketerName || '—'} />
        <DetailInfo label="Transfer Date" value={new Date(incident.transferDate).toLocaleDateString()} />
        <DetailInfo label="Time Transferred" value={incident.timeOfTransfer || 'N/A'} />
        <DetailInfo label="First Contact" value={incident.timeOfFirstContact || 'N/A'} />
      </div>

      <div className="mb-10">
         <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Carrier Explanation</h4>
         <div className="bg-[var(--card2)] p-6 rounded-2xl border border-[var(--border)] text-sm leading-relaxed text-[var(--text)] italic shadow-inner">
           "{incident.explanation}"
         </div>
         {incident.documentUrl && (
           <div className="mt-4">
             <a href={incident.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-accent hover:text-accent-hover transition-colors px-4 py-2 border border-accent/30 rounded-lg hover:bg-accent/10">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
               View Generated Record Text File
             </a>
           </div>
         )}
      </div>

      {((incident.screenshots && incident.screenshots.length > 0) || incident.screenshot) && (
        <div className="mb-10">
           <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Attachments</h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {(() => {
               const imgs = [...(incident.screenshots || [])];
               if (incident.screenshot && !imgs.includes(incident.screenshot)) imgs.unshift(incident.screenshot);
               return imgs.map((img, idx) => (
                 <div key={idx} className="relative group cursor-pointer" onClick={() => img.includes('application/') || img.includes('text/') || img.includes('.pdf') || img.includes('.txt') ? window.open(img, '_blank') : onZoom(img)}>
                    {img.includes('application/') || img.includes('text/') || img.includes('.pdf') || img.includes('.txt') ? (
                       <div className="w-full h-48 bg-[var(--card2)] rounded-2xl shadow-xl shadow-black/40 border border-[var(--border)] flex flex-col items-center justify-center hover:border-accent transition-colors">
                          <span className="text-sm font-bold text-accent break-all px-4 text-center">DOCUMENT ATTACHMENT</span>
                          <span className="text-[10px] text-[var(--text-muted)] mt-2 font-mono">Click to open</span>
                       </div>
                    ) : (
                       <>
                         <img src={img} className="w-full h-48 object-cover rounded-2xl shadow-xl shadow-black/40 border border-[var(--border)] grayscale hover:grayscale-0 transition-all hover:scale-[1.01]" alt={`Proof ${idx + 1}`} />
                         <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                            <Search className="w-8 h-8 text-white" />
                         </div>
                       </>
                    )}
                 </div>
               ));
             })()}
           </div>
        </div>
      )}

      {ld && (
        <div className="mb-10 border-t border-[var(--border)] pt-10">
           <div className="flex items-center gap-3 mb-6">
              <Truck className="text-accent w-6 h-6" />
              <h4 className="font-bold text-lg">Load Specification Metadata</h4>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <DetailInfo label="MC Number" value={ld.mcNumber || '—'} highlight />
              <DetailInfo label="DOT Number" value={ld.dotNumber || '—'} highlight />
              <DetailInfo label="Vehicle" value={ld.vehicleType + (ld.vehicleSpecs ? ` (${ld.vehicleSpecs})` : '')} />
              <DetailInfo label="Route" value={`${ld.originCity}, ${ld.originState}`} suffix={<ArrowRight className="w-3 h-3 mx-2 inline" />} />
              <DetailInfo label="Destination" value={`${ld.destCity}, ${ld.destState}`} />
              <DetailInfo label="Distance" value={ld.distance + ' Miles'} />
              <DetailInfo label="Rate/Mile" value={'$' + ld.ratePerMile} />
              <DetailInfo label="Total Price" value={'$' + ld.totalPrice} highlight />
              <DetailInfo label="Weight" value={ld.loadSize + ' lbs'} />
              <DetailInfo label="Marketer" value={ld.marketer || '—'} />
              <DetailInfo label="Activation Status" value={ld.wentActive || '—'} />
              <DetailInfo label="Carrier Status" value={incident.status || '—'} />
           </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 pt-8 border-t border-[var(--border)]">
        <button onClick={onAddLd} className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-accent/30 text-accent rounded-xl font-bold hover:bg-accent/10 transition-all">
          <Truck className="w-4 h-4" /> {ld ? 'Edit Load Spec' : 'Add Load Details'}
        </button>
        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-3 border border-[var(--input-border)] rounded-xl font-bold hover:bg-white/5 transition-all">
          <PenSquare className="w-4 h-4" /> Edit Record
        </button>
        <button onClick={onDelete} className="flex items-center gap-2 px-6 py-3 border border-[var(--input-border)] text-red-400 rounded-xl font-bold hover:bg-red-500/10 transition-all">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    </div>
  );
}

function DetailInfo({ label, value, highlight, suffix }: { label: string, value: string, highlight?: boolean, suffix?: any }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)]">{label}</p>
      <div className="flex items-center">
        <p className={`text-sm font-bold ${highlight ? 'text-accent' : 'text-[var(--text)]'}`}>{value}</p>
        {suffix}
      </div>
    </div>
  );
}
