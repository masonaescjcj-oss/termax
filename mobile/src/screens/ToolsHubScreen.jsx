import React, {
   useEffect, useState, useRef, useMemo, Fragment, useCallback
} from 'react';

import {
   View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated, Modal, Platform, Alert, Image, Linking 
} from 'react-native';

import {
   useNavigation, useFocusEffect
} from '@react-navigation/native';

import * as B from '../config';

import axios from 'axios';

import * as k from '../utils/storage';

import {
   useAccountStore 
} from '../store/accountStore';

import {
   LinearGradient 
} from 'expo-linear-gradient';

import { Text, TextInput } from '../components/Typography';
import GlassView from '../components/GlassView';
const BlurView = GlassView;

import GlassToast from '../components/GlassToast';

import AccountSwitcher from '../components/AccountSwitcher';

import ChatScreen from './ChatScreen';

import * as I from 'react-native-chart-kit';

import io from 'socket.io-client';

import * as D from 'expo-image-picker';

import {
   Audio as W 
} from 'expo-av';

import * as v from 'lucide-react-native';

import {
   useTheme 
} from '../theme/ThemeContext';

import {
   jsx as _jsx, jsxs as _jsxs 
} from 'react/jsx-runtime';


// Module mappings for the bundle code
const _ = {
   useTheme 
};

const s = React;

const w = {
   useNavigation 
};

const z = {
   default: axios 
};

const R = {
   default: io 
};

const A = {
   useAccountStore 
};

const d = {
   default: View 
};

const c = {
   default: Text 
};

const u = {
   default: StyleSheet 
};

const g = {
   default: ScrollView 
};

const f = {
   default: TouchableOpacity 
};

const h = {
   default: ActivityIndicator 
};

const m = {
   default: Dimensions 
};

const x = {
   default: TextInput 
};

const y = {
   default: Animated 
};

const b = {
   default: Modal 
};

const p = {
   default: Alert 
};

const j = {
   default: Image 
};

const C = {
   default: GlassToast 
};

const S = {
   default: AccountSwitcher 
};

const F = {
   LinearGradient 
};

const T = {
   BlurView: GlassView 
};

const L = {
  
  jsx: _jsx,
  jsxs: _jsxs,
  Fragment: Fragment

};


// Dimensions helper mapping
const M = Dimensions.get('window').width;


// Avatar assets
const n = [];

n[30] = require('../../assets/avatars/default.png');

n[31] = require('../../assets/avatars/dbz-trunks-pfp-01.jpg');

n[32] = require('../../assets/avatars/dbz-trunks-pfp-02.jpg');

n[33] = require('../../assets/avatars/dbz-trunks-pfp-03.jpg');

n[34] = require('../../assets/avatars/dbz-trunks-pfp-08.jpg');

n[35] = require('../../assets/avatars/dbz-trunks-pfp-10.jpg');

n[36] = require('../../assets/avatars/dbz-trunks-pfp-11.jpg');

n[37] = require('../../assets/avatars/dbz-trunks-pfp-12.jpg');

n[38] = require('../../assets/avatars/dbz-trunks-pfp-19.jpg');

n[39] = require('../../assets/avatars/dbz-trunks-pfp-21.jpg');

n[40] = require('../../assets/avatars/dbz-trunks-pfp-26.jpg');

n[41] = require('../../assets/avatars/dbz-trunks-pfp-35.jpg');

n[42] = require('../../assets/avatars/dbz-trunks-pfp-38.jpg');

n[43] = require('../../assets/avatars/dbz-trunks-pfp-45.jpg');

n[44] = require('../../assets/avatars/dbz-trunks-pfp-48.jpg');

n[45] = require('../../assets/avatars/gwenpool-pfp-01.jpg');

n[46] = require('../../assets/avatars/gwenpool-pfp-02.jpg');

n[47] = require('../../assets/avatars/gwenpool-pfp-03.jpg');

n[48] = require('../../assets/avatars/gwenpool-pfp-05.jpg');

n[49] = require('../../assets/avatars/gwenpool-pfp-08.jpg');

n[50] = require('../../assets/avatars/gwenpool-pfp-10.jpg');

n[51] = require('../../assets/avatars/gwenpool-pfp-11.jpg');

n[52] = require('../../assets/avatars/gwenpool-pfp-12.jpg');

n[53] = require('../../assets/avatars/gwenpool-pfp-16.jpg');

n[54] = require('../../assets/avatars/gwenpool-pfp-17.jpg');

n[55] = require('../../assets/avatars/gwenpool-pfp-18.jpg');

n[56] = require('../../assets/avatars/gwenpool-pfp-19.jpg');

n[57] = require('../../assets/avatars/gwenpool-pfp-23.jpg');

n[58] = require('../../assets/avatars/gwenpool-pfp-24.jpg');

n[59] = require('../../assets/avatars/gwenpool-pfp-25.jpg');

n[60] = require('../../assets/avatars/gwenpool-pfp-27.jpg');

n[61] = require('../../assets/avatars/gwenpool-pfp-29.jpg');

n[62] = require('../../assets/avatars/gwenpool-pfp-35.jpg');


// Helpers inside the closure
const t = (x) => x;

const P = (url) => {
    if (!url || url === '' || url === 'default') return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${B.BACKEND_URL}${url}`;
    try {
        const parsed = new URL(url);
        if (parsed.protocol) return url;
        return `${B.BACKEND_URL}${parsed.pathname}`;
    } catch {
        return `${B.BACKEND_URL}/${url}`;
    }
};


// Premium Animated Glass Card
const glassInnerStyle = {
   borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' 
};

const O = ({
   children, onPress, style, intensity = 25 
}) => {
  
    const {
     colors, isDark 
  } = useTheme();
  
    const scale = useRef(new y.default.Value(1)).current;
  

    const handlePressIn = () => y.default.spring(scale, {
     toValue: 0.96, useNativeDriver: true 
  }).start();
  
    const handlePressOut = () => y.default.spring(scale, {
     toValue: 1, useNativeDriver: true 
  }).start();
  

    const CardContent = (
        <BlurView 
            experimentalBlurMethod="regular"
            intensity={
    intensity
  } 
            tint={
    colors.blurTint
  } 
            style={
    [
                glassInnerStyle, 
                {
       
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.45)', 
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                    borderWidth: 1
                
    },
                style
            ]
  }
            {
    ...Platform.select({
       web: {
         className: 'premium-glass-medium' 
      }, default: {
        
      } 
    })
  }
        >
            {
    children
  }
        </BlurView>
    );
  

    if (onPress) {
    
        return (
            <y.default.View style={
      {
         transform: [{
           scale 
        }], flex: 1 
      }
    }>
                <TouchableOpacity activeOpacity={
      0.8
    } onPressIn={
      handlePressIn
    } onPressOut={
      handlePressOut
    } onPress={
      onPress
    } style={
      {
         flex: 1 
      }
    }>
                    {
      CardContent
    }
                </TouchableOpacity>
            </y.default.View>
        );
    
    
  }
    
    return <View style={
    {
       flex: 1 
    }
  }>{
    CardContent
  }</View>;
  

};


const U=e=>u.default.create({
  container:{
    flex:1
  },headerTitle:{
    fontSize:32,fontWeight:'900',color:e.text,letterSpacing:.5
  },headerSubtitle:{
    fontSize:15,color:e.textMuted,marginTop:4,fontWeight:'500'
  },backButton:{
    flexDirection:'row',alignItems:'center',marginBottom:16,alignSelf:'flex-start',paddingVertical:4,paddingRight:12
  },backText:{
    color:'#60A5FA',fontSize:15,marginLeft:6,fontWeight:'600'
  },glassInner:{
    borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'
  },cardGlow:Object.assign({
    
  },u.default.absoluteFillObject,{
    opacity:.6
  }),grid:{
    flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:16
  },gridItem:{
    width:(M-40-16)/2
  },dashboardCard:{
    padding:20,alignItems:'flex-start',minHeight:160
  },iconCircle:{
    width:52,height:52,borderRadius:26,backgroundColor:e.glassCard,justifyContent:'center',alignItems:'center',marginBottom:16
  },cardTitle:{
    fontSize:14,fontWeight:'800',color:e.text,marginBottom:6
  },cardDesc:{
    fontSize:13,color:e.textMuted,fontWeight:'500',lineHeight:18
  },wideCard:{
    borderRadius:24
  },wideCardContent:{
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:24
  },wideCardLeft:{
    flexDirection:'row',alignItems:'center'
  },analysisCard:{
    padding:24
  },analysisHeader:{
    flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20
  },analysisSymbol:{
    color:e.text,fontSize:24,fontWeight:'900'
  },trendBadge:{
    paddingHorizontal:12,paddingVertical:6,borderRadius:12
  },trendBadgeText:{
    fontSize:13,fontWeight:'800',letterSpacing:.5,textTransform:'uppercase'
  },rcContainer:{
    padding:24
  },rcInputGroup:{
    marginBottom:24
  },rcLabel:{
    color:e.textMuted,fontSize:14,fontWeight:'600',marginBottom:10
  },rcInput:{
    borderRadius:16,padding:18,fontSize:18,fontWeight:'700',borderWidth:1
  },rcBtnGradient:{
    paddingVertical:18,borderRadius:16,alignItems:'center',justifyContent:'center'
  },rcBtnText:{
    color:e.text,fontSize:17,fontWeight:'800',letterSpacing:.5
  },ruleBtn:{
    flex:1,paddingVertical:16,borderRadius:16,borderWidth:1,alignItems:'center'
  },ruleBtnActive:{
    backgroundColor:'rgba(245,158,11,0.2)',borderColor:'#F59E0B'
  },ruleBtnText:{
    color:e.textMuted,fontSize:15,fontWeight:'700'
  },ruleBtnTextActive:{
    color:'#FBBF24'
  },filterChip:{
    paddingHorizontal:18,paddingVertical:8,borderRadius:24,backgroundColor:e.glassCard,borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginRight:10
  },filterChipActive:{
    backgroundColor:'#3B82F6',borderColor:'#3B82F6'
  },filterChipText:{
    color:e.textMuted,fontSize:14,fontWeight:'600'
  },filterChipTextActive:{
    color:e.text
  },heatBlock:{
    borderRadius:16,justifyContent:'center',alignItems:'center',padding:12,borderWidth:1
  },heatSymbol:{
    color:e.text,fontWeight:'800',fontSize:15,marginBottom:4
  },heatChange:{
    color:e.text,fontWeight:'800',fontSize:14,marginLeft:4
  },heatPrice:{
    color:'rgba(18,22,31,0.7)',fontSize:11,marginTop:4,fontWeight:'600'
  },accountRow:{
    flexDirection:'row',marginBottom:16
  },accountCard:{
    padding:20
  },accountLabel:{
    color:e.textMuted,fontSize:14,fontWeight:'600',marginBottom:8
  },accountValue:{
    color:e.text,fontSize:26,fontWeight:'900'
  },statLabel:{
    color:e.textMuted,fontSize:13,fontWeight:'600',marginBottom:6
  },accountSwitcherBtn:{
    backgroundColor:e.glassCard,padding:8,paddingRight:12,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'
  },accountBadge:{
    paddingHorizontal:8,paddingVertical:4,borderRadius:8
  },accountBadgeText:{
    fontSize:10,fontWeight:'900',letterSpacing:.5
  },accountBrokerText:{
    color:e.text,fontSize:13,fontWeight:'700'
  },accountIdText:{
    color:e.textMuted,fontSize:11,fontWeight:'600'
  },modalOverlay:{
    flex:1,backgroundColor:'rgba(18,22,31,0.85)',justifyContent:'flex-end'
  },modalContent:{
    borderTopLeftRadius:32,borderTopRightRadius:32,padding:24,paddingTop:12,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'
  },modalHandle:{
    width:40,height:4,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:2,alignSelf:'center',marginBottom:24
  },modalTitle:{
    color:e.text,fontSize:22,fontWeight:'900',marginBottom:4
  },modalSubtitle:{
    color:e.textMuted,fontSize:14,marginBottom:24
  },accountOption:{
    flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,borderRadius:16,marginBottom:12,borderWidth:1
  },accountOptionSelected:{
    backgroundColor:'rgba(59,130,246,0.15)',borderColor:'#3B82F6'
  },accountOptionBroker:{
    color:e.text,fontSize:16,fontWeight:'800'
  },accountOptionId:{
    color:e.textMuted,fontSize:13,marginTop:2
  },accountOptionBalance:{
    color:e.text,fontSize:16,fontWeight:'900'
  }
});


function ToolsHubInner(initialActiveTool = null, onBack = null, onActiveToolChange = null, isEmbedded = false){
  const{
    colors:e,isDark:r
  }=(0,_.useTheme)(),o=(0,s.useMemo)(()=>U(e),[e]),l=(0,w.useNavigation)(),a={
    default:t(n[30]),dbz_trunks_01:t(n[31]),dbz_trunks_02:t(n[32]),dbz_trunks_03:t(n[33]),dbz_trunks_08:t(n[34]),dbz_trunks_10:t(n[35]),dbz_trunks_11:t(n[36]),dbz_trunks_12:t(n[37]),dbz_trunks_19:t(n[38]),dbz_trunks_21:t(n[39]),dbz_trunks_26:t(n[40]),dbz_trunks_35:t(n[41]),dbz_trunks_38:t(n[42]),dbz_trunks_45:t(n[43]),dbz_trunks_48:t(n[44]),gwenpool_01:t(n[45]),gwenpool_02:t(n[46]),gwenpool_03:t(n[47]),gwenpool_05:t(n[48]),gwenpool_08:t(n[49]),gwenpool_10:t(n[50]),gwenpool_11:t(n[51]),gwenpool_12:t(n[52]),gwenpool_16:t(n[53]),gwenpool_17:t(n[54]),gwenpool_18:t(n[55]),gwenpool_19:t(n[56]),gwenpool_23:t(n[57]),gwenpool_24:t(n[58]),gwenpool_25:t(n[59]),gwenpool_27:t(n[60]),gwenpool_29:t(n[61]),gwenpool_35:t(n[62])
  },i=(e,t)=>e&&'default'!==e?e.startsWith('http')||e.startsWith('data:')?{
    avatar:'',avatarImg:{
      uri:e
    }
  }:e.startsWith('/')?{
    avatar:'',avatarImg:{
      uri:`${B.BACKEND_URL}${e}`
    }
  }:a[e]?{
    avatar:'',avatarImg:a[e]
  }:{
    avatar:e,avatarImg:null
  }:{
    avatar:t.substring(0,2).toUpperCase().replace('@',''),avatarImg:a.default
  },[m,y]=(0,s.useState)([]),[E,V]=(0,s.useState)([]),[$,H]=(0,s.useState)([]),[N,G]=(0,s.useState)(null),[K,J]=(0,s.useState)([]),[q,Y]=(0,s.useState)([]),[Q,Z]=(0,s.useState)([]),[X,ee]=(0,s.useState)([]),[te,re]=(0,s.useState)(!0),[oe,le]=(0,s.useState)(initialActiveTool),[ae,ne]=(0,s.useState)('All'),[ie,se]=(0,s.useState)(null),[de,ce]=(0,s.useState)('All'),[ue,ge]=(0,s.useState)('Discover'),[fe,he]=(0,s.useState)([]);
  (0,s.useEffect)(()=>{
    if (initialActiveTool !== undefined) {
      le(initialActiveTool);
    }
  }, [initialActiveTool]);
  (0,s.useEffect)(()=>{
    if (!B.isTelegram) return;
    const canGoBackInHub = oe !== null && oe !== 'tools_hub' && oe !== initialActiveTool;
    if (canGoBackInHub) {
      window.customTelegramBackHandler = () => {
        le(e => {
          if (e === 'broker_details') return 'broker_list';
          if (e === 'community_chat') return 'chat_groups';
          if (e === 'community_profile') return 'community_chat';
          if (e !== null && e !== 'tools_hub' && e !== 'broker_list' && e !== 'chat_groups') return null;
          if (e === 'broker_list' || e === 'chat_groups') return null;
          return null;
        });
        return true;
      };
    } else {
      window.customTelegramBackHandler = null;
    }
    return () => {
      window.customTelegramBackHandler = null;
    };
  }, [oe, initialActiveTool]);
  (0,s.useEffect)(()=>{
    (async()=>{
      try{
        (0,k.getItemAsync)('cached_community_groups').then(e=>{
          if(e)try{
            const t=JSON.parse(e);
            _e(t);
            const r=t.filter(e=>e.isMember).map(e=>e.name);
            he(r);
          }catch(e){
            
          }
        });
        const e=await(0,k.getItemAsync)('accessToken'),t=e?{
          Authorization:`Bearer ${
            e
          }`
        }:{
          
        },r=await z.default.get(`${
          B.BACKEND_URL
        }/api/v1/communities`,{
          headers:t
        });
        if(r.data?.success&&r.data.data){
          _e(r.data.data),(0,k.setItemAsync)('cached_community_groups',JSON.stringify(r.data.data));
          const e=r.data.data.filter(e=>e.isMember).map(e=>e.name);
          he(e);
        }
      }catch(e){
        
      }
    })()
  },[]);
  const{
    addDemoAccount:me,removeDemoAccount:xe,mockAccounts:ye
  }=(0,A.useAccountStore)(),[be,pe]=(0,s.useState)(''),[je,Ce]=(0,s.useState)(1e4),[Se,we]=(0,s.useState)('USD'),[Be,ze]=(0,s.useState)('1:100'),[ke,Ae]=(0,s.useState)(!1),[Fe,Te]=(0,s.useState)(['@you','you']),[Ie,Re]=(0,s.useState)(null),[De,We]=(0,s.useState)('user'),[ve,_e]=(0,s.useState)([]),[Le,Me]=(0,s.useState)(!1),[Pe,Ee]=(0,s.useState)(''),[Oe,Ve]=(0,s.useState)(''),[Ue,$e]=(0,s.useState)('Official Brokers'),[He,Ne]=(0,s.useState)(null);
  (0,s.useEffect)(()=>{
    (0,k.getItemAsync)('accessToken').then(e=>{
      if(e)try{
        let t=e.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        for(;
        t.length%4;
        )t+='=';
        let r='';
        try{
          const e='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let o='';
          for(let r=0;
          r<t.length;
          r+=4){
            const l=e.indexOf(t.charAt(r)),a=e.indexOf(t.charAt(r+1)),n=e.indexOf(t.charAt(r+2)),i=e.indexOf(t.charAt(r+3));
            o+=String.fromCharCode(l<<2|a>>4),64!==n&&(o+=String.fromCharCode((15&a)<<4|n>>2)),64!==i&&(o+=String.fromCharCode((3&n)<<6|i))
          }r=o
        }catch(e){
          
        }if(r){
          const e=JSON.parse(r);
          e&&(e.id&&Re(e.id),e.role?We(e.role):e._id?Re(e._id):e.sub&&Re(e.sub),e.username&&Te(t=>{
            const r=[...t];
            return r.push(e.username.toLowerCase()),r.push(('@'+e.username).toLowerCase()),r
          }))
        }
      }catch(e){
        
      }
    }),(0,k.getItemAsync)('tg_cached_profile').then(e=>{
      if(e)try{
        const t=JSON.parse(e),r=[];
        t.username&&(r.push(t.username.toLowerCase()),r.push(('@'+t.username).toLowerCase())),t.first_name&&r.push(t.first_name.toLowerCase()),t.firstName&&r.push(t.firstName.toLowerCase()),t.name&&r.push(t.name.toLowerCase()),t.first_name&&t.last_name&&r.push(`${
          t.first_name
        } ${
          t.last_name
        }`.toLowerCase()),t.firstName&&t.lastName&&r.push(`${
          t.firstName
        } ${
          t.lastName
        }`.toLowerCase()),r.length>0&&Te(e=>[...e,...r])
      }catch(e){
        
      }
    })
  },[]);
  const[Ge,Ke]=(0,s.useState)(!1),[Je,qe]=(0,s.useState)(''),[Ye,Qe]=(0,s.useState)('success'),Ze=(e,t="success")=>{
    qe(e),Qe(t),Ke(!0)
  };
  (0,s.useEffect)(()=>{
    if(onActiveToolChange)onActiveToolChange(oe);
    const shouldHide = oe !== null && oe !== 'tools_hub' && oe !== 'chat_groups';
    l.setOptions({
      tabBarStyle: shouldHide ? { display: 'none' } : {
        backgroundColor:e.glassCard,borderTopColor:'transparent',height:B.isTelegram?50:60,paddingBottom:B.isTelegram?4:8,paddingTop:8,display:'flex'
      }
    });

    return () => {
      l.setOptions({
        tabBarStyle:{
          backgroundColor:e.glassCard,borderTopColor:'transparent',height:B.isTelegram?50:60,paddingBottom:B.isTelegram?4:8,paddingTop:8,display:'flex'
        }
      });
    };
  },[oe]);
  const[Xe,et]=(0,s.useState)(!1),{
    selectedAccount:tt,setSelectedAccount:rt,mockAccounts:ot
  }=(0,A.useAccountStore)(),lt=tt,at=rt,nt=ot,[it,st]=(0,s.useState)('BTC/USDT'),[dt,ct]=(0,s.useState)('BREAK_EVEN'),[ut,gt]=(0,s.useState)('20'),[ft,ht]=(0,s.useState)('50'),[mt,xt]=(0,s.useState)(null),[yt,bt]=(0,s.useState)(!1),[pt,jt]=(0,s.useState)(''),[Ct,St]=(0,s.useState)([]),[wt,Bt]=(0,s.useState)(null),[zt,kt]=(0,s.useState)(''),[At,Ft]=(0,s.useState)(null),[Tt,It]=(0,s.useState)(null),[Rt,Dt]=(0,s.useState)(null),[Wt,vt]=(0,s.useState)(!1),[_t,Lt]=(0,s.useState)(!1),[Mt,Pt]=(0,s.useState)([]),[Et,Ot]=(0,s.useState)([]),[Vt,Ut]=(0,s.useState)(!0),[$t,Ht]=(0,s.useState)([]),[Nt,Gt]=(0,s.useState)(null),Kt=(0,s.useRef)(null),Jt=(0,s.useRef)(null),qt=(0,s.useRef)(null),[Yt,Qt]=(0,s.useState)('mic'),[Zt,Xt]=(0,s.useState)(!1),[er,tr]=(0,s.useState)(0),rr=((0,s.useRef)(null),(0,s.useRef)(null)),or=(0,s.useRef)(null),lr=(0,s.useRef)([]),[ar,nr]=(0,s.useState)(null),ir=(0,s.useRef)(null),[sr,dr]=(0,s.useState)(0),[cr,ur]=(0,s.useState)(null),[gr,fr]=(0,s.useState)(!1),hr=(0,s.useRef)({
    
  });
  (0,s.useEffect)(()=>{
    ('community_chat'===oe||'community_profile'===oe)&&pt?mr(pt):Jt.current&&(Jt.current.disconnect(),Jt.current=null)
  },[oe,pt]);

  (0,s.useEffect)(()=>{
    if (B.isTelegram && typeof window !== 'undefined') {
      if (oe === null || oe === 'tools_hub') {
        document.title = 'Tools Hub';
      } else if (oe === 'broker_list') {
        document.title = 'Brokers';
      } else if (oe === 'broker_details') {
        document.title = He?.name || 'Broker Details';
      } else if (oe === 'chat_groups') {
        document.title = 'Chat Groups';
      } else if (oe === 'community_profile') {
        document.title = pt ? `${pt} Profile` : 'Community Profile';
      }
    }
  },[oe, He, pt]);
  const mr=async e=>{
    Bt('Connecting...');
    const t=`chat_history_${
      e
    }`,r=await(0,k.getItemAsync)(t);
    if(r)try{
      St(JSON.parse(r)),Bt('Updating...')
    }catch(e){
      St([])
    }else St([]);
    const o=await(0,k.getItemAsync)(`chat_pinned_${
      e
    }`);
    if(o)try{
      Gt(JSON.parse(o))
    }catch(e){
      Gt(null)
    }else Gt(null);
    Ut(!0),Ht([]);
    await(0,k.getItemAsync)('accessToken');
    Jt.current&&Jt.current.disconnect();
    const l=(0,R.default)(B.BACKEND_URL,{transports:['websocket']});
    Jt.current=l,l.on('connect',()=>{
      l.emit('joinChat',e)
    }),l.on('chatHistory',t=>{
      const r=t.map(e=>{
        const t=i(e.avatarUrl,e.username||'@U');
        return{
          id:e._id,userId:e.userId||e.senderId||e.sender||null,user:'You'===e.username?'@You':e.username,avatar:t.avatar,avatarImg:t.avatarImg,text:e.text,mediaUrl:e.mediaUrl,replyTo:e.replyTo,time:e.createdAt?new Date(e.createdAt).toLocaleTimeString(undefined,{
            hour:'2-digit',minute:'2-digit'
          }):'',likes:Array.isArray(e.likes)?e.likes.length:e.likes,likedBy:Array.isArray(e.likes)?e.likes:[],isPro:e.isPro
        }
      });
      St(t=>{
        const o=[...t,...r],l=Array.from(new Map(o.map(e=>[e.id,e])).values()).slice(-90);
        return(0,k.setItemAsync)(`chat_history_${
          e
        }`,JSON.stringify(l)),l
      }),Bt(null)
    }),l.on('newMessage',t=>{
      const r=i(t.avatarUrl,t.username||'@U');
      St(o=>{
        const l=[...o,{
          id:t._id,userId:t.userId||t.senderId||t.sender||null,user:'You'===t.username?'@You':t.username,avatar:r.avatar,avatarImg:r.avatarImg,text:t.text,mediaUrl:t.mediaUrl,replyTo:t.replyTo,time:t.createdAt?new Date(t.createdAt).toLocaleTimeString(undefined,{
            hour:'2-digit',minute:'2-digit'
          }):'',likes:Array.isArray(t.likes)?t.likes.length:t.likes,likedBy:Array.isArray(t.likes)?t.likes:[],isPro:t.isPro
        }].slice(-90);
        return(0,k.setItemAsync)(`chat_history_${
          e
        }`,JSON.stringify(l)),l
      }),setTimeout(()=>qt.current?.scrollToEnd?.({
        animated:!0
      }),100)
    }),l.on('messageUpdated',e=>{
      St(t=>t.map(t=>t.id===e.messageId?Object.assign({
        
      },t,{
        likes:e.likes,likedBy:e.likedBy
      }):t))
    }),l.on('olderMessages',t=>{
      if(0===t.length)Ut(!1);
      else{
        const r=t.map(e=>{
          const t=i(e.avatarUrl,e.username||'@U');
          return{
            id:e._id,userId:e.userId||null,user:'You'===e.username?'@You':e.username,avatar:t.avatar,avatarImg:t.avatarImg,text:e.text,mediaUrl:e.mediaUrl,replyTo:e.replyTo,time:new Date(e.createdAt).toLocaleTimeString([],{
              hour:'2-digit',minute:'2-digit'
            }),likes:Array.isArray(e.likes)?e.likes.length:e.likes,likedBy:Array.isArray(e.likes)?e.likes:[],isPro:e.isPro
          }
        });
        St(t=>{
          const o=[...r,...t],l=Array.from(new Map(o.map(e=>[e.id,e])).values()).slice(-90);
          return(0,k.setItemAsync)(`chat_history_${
            e
          }`,JSON.stringify(l)),l
        }),t.length<50&&Ut(!1)
      }Lt(!1)
    }),l.on('userTyping',e=>{
      e.username&&(Ht(t=>t.includes(e.username)?t:[...t,e.username]),setTimeout(()=>{
        Ht(t=>t.filter(t=>t!==e.username))
      },3e3))
    }),l.on('membersList',e=>{
      e.members&&Pt(e.members),e.admins&&Ot(e.admins)
    }),l.on('memberCountUpdate',t=>{
      _e(r=>r.map(r=>r.name===e?Object.assign({
        
      },r,{
        memberCount:t
      }):r))
    }),l.on('messageDeleted',e=>{
      St(t=>t.filter(t=>t.id!==e.messageId))
    }),l.on('communityInfo',t=>{
      t.pinnedMessageId?(Gt(t.pinnedMessage),(0,k.setItemAsync)(`chat_pinned_${
        e
      }`,JSON.stringify(t.pinnedMessage))):(Gt(null),(0,k.setItemAsync)(`chat_pinned_${
        e
      }`,''))
    }),l.on('messagePinned',t=>{
      Gt(t),(0,k.setItemAsync)(`chat_pinned_${
        e
      }`,JSON.stringify(t))
    }),l.on('messageUnpinned',()=>{
      Gt(null),(0,k.setItemAsync)(`chat_pinned_${
        e
      }`,'')
    }),l.on('userKicked',t=>{
      Pt(e=>e.filter(e=>e._id!==t.userId)),t.userId===Ie&&(he(t=>t.filter(t=>t!==e)),le('chat_groups'),p.default.alert('Kicked','You were removed from the community by an administrator.'))
    })
  },xr=async()=>{
    if(!zt.trim()&&!At||!Jt.current)return;
    const e=await(0,k.getItemAsync)('accessToken');
    e&&(Jt.current.emit('sendMessage',{
      room:pt,token:e,text:zt,mediaUrl:At,replyTo:Tt?Tt.id:null
    }),kt(''),Ft(null),It(null))
  },yr=async e=>{
    const t=await(0,k.getItemAsync)('accessToken');
    t&&Jt.current&&(Jt.current.emit('deleteMessage',{
      room:pt,token:t,messageId:e
    }),Dt(null))
  },br=async e=>{
    const t=await(0,k.getItemAsync)('accessToken');
    t&&Jt.current&&(Jt.current.emit('pinMessage',{
      room:pt,token:t,messageId:e
    }),Dt(null))
  },pr=async()=>{
    const e=await(0,k.getItemAsync)('accessToken');
    e&&Jt.current&&Jt.current.emit('unpinMessage',{
      room:pt,token:e
    })
  },jr=async e=>{
    p.default.alert("Kick User","Are you sure you want to remove this user from the community?",[{
      text:"Cancel",style:"cancel"
    },{
      text:"Kick",style:"destructive",onPress:async()=>{
        const t=await(0,k.getItemAsync)('accessToken');
        t&&Jt.current&&Jt.current.emit('kickUser',{
          room:pt,token:t,targetUserId:e
        })
      }
    }])
  },Cr=async(e,t,r,o)=>{
    if(!e.trim())return p.default.alert('Validation Error','Group name is required.');
    try{
      const l=await(0,k.getItemAsync)('accessToken');
      if(!l)return;
      let a=o||'';
      if(o&&o.startsWith('data:'))try{
        const e=await z.default.post(`${
          B.BACKEND_URL
        }/api/v1/admin/upload`,{
          imageBase64:o
        },{
          headers:{
            Authorization:`Bearer ${
              l
            }`
          }
        });
        e.data?.success&&e.data.url&&(a=e.data.url)
      }catch(e){
        console.error('Failed to upload group image:',e)
      }const n=await z.default.post(`${
        B.BACKEND_URL
      }/api/v1/admin/communities`,{
        name:e.trim(),description:t.trim(),category:r||'Official Brokers',imageUrl:a,iconColor:'#3B82F6'
      },{
        headers:{
          Authorization:`Bearer ${
            l
          }`
        }
      });
      if(n.data?.success){
        const t=await z.default.get(`${
          B.BACKEND_URL
        }/api/v1/communities`,{
          headers:{
            Authorization:`Bearer ${
              l
            }`
          }
        });
        if(t.data?.success&&t.data.data){
          _e(t.data.data),(0,k.setItemAsync)('cached_community_groups',JSON.stringify(t.data.data));
          const e=t.data.data.filter(e=>e.isMember).map(e=>e.name);
          e.length>0&&he(e)
        }Me(!1),Ee(''),Ve(''),Ne(null),p.default.alert('Success',`Group "${
          e
        }" created successfully!`)
      }
    }catch(e){
      p.default.alert('Error',e?.response?.data?.message||'Failed to create group')
    }
  },Sr=async()=>{
    let e=await D.launchImageLibraryAsync({
      mediaTypes:D.MediaTypeOptions.Images,allowsEditing:!0,aspect:[1,1],quality:.5,base64:!0
    });
    !e.canceled&&e.assets[0].base64&&Ne(`data:image/jpeg;
    base64,${
      e.assets[0].base64
    }`)
  },wr=async()=>{
    let e=await D.launchImageLibraryAsync({
      mediaTypes:D.MediaTypeOptions.Images,allowsEditing:!0,quality:.5,base64:!0
    });
    !e.canceled&&e.assets[0].base64&&Ft(`data:image/jpeg;
    base64,${
      e.assets[0].base64
    }`)
  },Br=async e=>{
    const t=await(0,k.getItemAsync)('accessToken');
    t&&Jt.current&&Jt.current.emit('likeMessage',{
      room:pt,token:t,messageId:e
    })
  },zr=async()=>{
    if(!_t&&Vt&&0!==Ct.length){
      Lt(!0);
      try{
        if(!await(0,k.getItemAsync)('accessToken')||!Jt.current)return void Lt(!1);
        Jt.current.emit('loadOlder',{
          room:pt,beforeId:Ct[0]?.id
        })
      }catch(e){
        Lt(!1)
      }
    }
  },kr=async()=>{
    try{
      {
        const e=await navigator.mediaDevices.getUserMedia({
          audio:!0
        }),t=new MediaRecorder(e,{
          mimeType:'audio/webm'
        });
        lr.current=[],t.ondataavailable=e=>{
          e.data.size>0&&lr.current.push(e.data)
        },or.current=t,t.start(),Xt(!0),tr(0),rr.current=setInterval(()=>tr(e=>e+1),1e3)
      }
    }catch(e){
      console.error('Failed to start recording',e)
    }
  },Ar=async()=>{
    clearInterval(rr.current),Xt(!1);
    const e=er;
    try{
      {
        const t=or.current;
        if(!t)return;
        await new Promise(e=>{
          t.onstop=()=>e(),t.stop()
        }),t.stream?.getTracks().forEach(e=>e.stop());
        const r=new Blob(lr.current,{
          type:'audio/webm'
        });
        if(or.current=null,lr.current=[],Jt.current){
          const t=await(0,k.getItemAsync)('accessToken');
          if(!t)return;
          const o=new FileReader;
          o.onloadend=()=>{
            const r=o.result;
            Jt.current.emit('sendMessage',{
              room:pt,token:t,text:`\ud83c\udf99\ufe0f Voice (${
                Tr(e)
              })`,mediaUrl:r,replyTo:Tt?Tt.id:null
            }),It(null)
          },o.readAsDataURL(r)
        }
      }
    }catch(e){
      console.error('Failed to stop recording',e)
    }
  },Fr=async()=>{
    clearInterval(rr.current),Xt(!1);
    try{
      {
        const e=or.current;
        e&&(e.stop(),e.stream?.getTracks().forEach(e=>e.stop())),or.current=null,lr.current=[]
      }
    }catch(e){
      
    }
  },Tr=e=>`${
    Math.floor(e/60)
  }:${
    (e%60).toString().padStart(2,'0')
  }`,Ir=async(e,t)=>{
    try{
      if(ir.current&&(await ir.current.unloadAsync(),ir.current=null),ar===e)return nr(null),void dr(0);
      await W.Audio.setAudioModeAsync({
        allowsRecordingIOS:!1,playsInSilentModeIOS:!0
      });
      const{
        sound:r
      }=await W.Audio.Sound.createAsync({
        uri:t
      });
      ir.current=r,nr(e),dr(0),r.setOnPlaybackStatusUpdate(e=>{
        e.isLoaded&&e.durationMillis&&dr(e.positionMillis/e.durationMillis),e.didJustFinish&&(nr(null),dr(0))
      }),await r.playAsync()
    }catch(e){
      console.error('Voice play error',e)
    }
  },[Rr,Dr]=(0,s.useState)('BTC/USDT'),[Wr,vr]=(0,s.useState)('2'),[_r,Lr]=(0,s.useState)('500'),[Mr,Pr]=(0,s.useState)(null),[Er,Or]=(0,s.useState)(!1);
  useFocusEffect(
    useCallback(() => {
      Vr();
    }, [])
  );
  const Vr=async()=>{
    re(X.length === 0);
    try{
      const e=await(0,k.getItemAsync)('accessToken'),t=e?{
        headers:{
          Authorization:`Bearer ${
            e
          }`
        }
      }:{
        
      },[r,o,l,a,n,i,s,d]=await Promise.all([z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/heatmap`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/analysis`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/calendar`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/analytics`,t).catch(()=>({
        data:{
          data:null
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/smc`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/mtf`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/tools/liquidity-map`).catch(()=>({
        data:{
          data:[]
        }
      })),z.default.get(`${
        B.BACKEND_URL
      }/api/v1/brokers`).catch(()=>({
        data:{
          data:[]
        }
      }))]);
      y(r.data.data),V(o.data.data),H(l.data.data),G(a.data.data),J(n.data.data),Y(i.data.data),Z(s.data.data),ee(d?.data?.data||[]),a.data
    }catch(e){
      console.error('Failed to fetch tools data',e)
    }finally{
      re(!1)
    }
  },Ur=async()=>{
    if(it&&ut){
      bt(!0);
      try{
        const e=await z.default.post(`${
          B.BACKEND_URL
        }/api/v1/trade/advanced-manager`,{
          positionId:it,ruleType:dt,triggerPips:Number(ut),actionValue:'PARTIAL_TP'===dt?Number(ft):null
        });
        e.data.success&&(xt(e.data.message),setTimeout(()=>xt(null),3e3))
      }catch(e){
        console.error('Manager error',e)
      }finally{
        bt(!1)
      }
    }
  },$r=async()=>{
    if(Rr&&Wr&&_r){
      Or(!0);
      try{
        const e=await z.default.post(`${
          B.BACKEND_URL
        }/api/v1/trade/calculate-lot`,{
          symbol:Rr.toUpperCase(),riskPercent:Number(Wr),stopLossDistance:Number(_r)
        });
        e.data.success&&Pr(e.data.data)
      }catch(e){
        console.error('Risk calc error',e)
      }finally{
        Or(!1)
      }
    }
  },Hr=e=>{
    if(!e)return'';
    const t=new Date(e).getTime()-Date.now();
    if(t<0)return'Released';
    const r=Math.floor(t/36e5),o=Math.floor(t%36e5/6e4);
    return r>24?`${
      Math.floor(r/24)
    }d ${
      r%24
    }h`:`${
      r
    }h ${
      o
    }m`
  },Nr=(t,r,l=!0)=>(0,L.jsx)(d.default,{
    style:{
      marginBottom:24
    },children:(0,L.jsx)(d.default,{
      style:{
        flexDirection:'row',justifyContent:'space-between',alignItems:'center'
      },children:[(0,L.jsxs)(d.default,{
        style:{
          flex:1,
          flexDirection:'row',
          alignItems:'center'
        },children:[l&&!B.isTelegram&&(0,L.jsx)(f.default,{
          onPress:()=>{
             if (oe === initialActiveTool && onBack) {
               onBack();
            } else {
               le(e => {
                 if (e === 'broker_details') return 'broker_list';
                 if (e === 'community_chat') return 'chat_groups';
                 if (e === 'community_profile') return 'community_chat';
                 if (e !== null && e !== 'tools_hub' && e !== 'broker_list' && e !== 'chat_groups') return 'tools_hub';
                 if (e === 'broker_list' || e === 'chat_groups') return 'tools_hub';
                 if (onBack) onBack();
                 return null;
               });
            } 
          },activeOpacity:.8,style:{
            width:38,
            height:38,
            borderRadius:12,
            backgroundColor:'#000000',
            borderWidth:1,
            borderColor:r?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)',
            justifyContent:'center',
            alignItems:'center',
            marginRight:12
          },children:(0,L.jsx)(v.ArrowLeft,{
            color:e.text,size:18
          })
        }),(0,L.jsx)(c.default,{
          numberOfLines:1,adjustsFontSizeToFit:!0,style:[o.headerTitle,{
            color:e.text,fontSize:18,fontWeight:'800'
          }],children:t
        })]
      })]
    })
  });
  (0,s.useEffect)(()=>{
    'community_profile'===oe&&Jt.current&&pt&&Jt.current.emit('getMembers',{
      room:pt
    })
  },[oe]);
  const Gr=[1e3,5e3,1e4,25e3,5e4,1e5],Kr=['USD','EUR','GBP','JPY','AUD','CHF'],Jr=['1:50','1:100','1:200','1:500','1:1000'],qr=async()=>{
    try{
      const e=await(0,k.getItemAsync)('accessToken');
      if(!e&&!B.isTelegram)return Ze('Please login or register to create a demo account','error'),void setTimeout(()=>l.navigate('MainTabs', { screen: 'Login' }),1500);
      const t=Math.floor(1e5+9e5*Math.random()).toString(),r=be||'Demo Trading';
      if((await z.default.post(`${
        B.BACKEND_URL
      }/api/v1/auth/connect-broker`,{
        cTraderId:t,accessToken:'demo_internal',accountType:'DEMO',broker:r,balance:je,currency:Se,leverage:Be
      },{
        headers:{
          Authorization:`Bearer ${
            e
          }`
        }
      })).data.success){
        const e={
          id:t,broker:r,type:'DEMO',balance:je,currency:Se,leverage:Be,createdAt:(new Date).toISOString()
        };
        me(e),Ae(!0),Ze(`\u2705 Demo account "${
          r
        }" created! ID: ${
          t
        } \u2014 Balance: ${
          Se
        } ${
          je.toLocaleString()
        }`,'success'),setTimeout(()=>{
          Ae(!1),pe(''),Ce(1e4)
        },2500)
      }
    }catch(e){
      console.log('Backend demo creation failed, creating locally:',e.message);
      const t=be||'Demo Trading',r=Math.floor(1e5+9e5*Math.random()).toString(),o={
        id:r,broker:t,type:'DEMO',balance:je,currency:Se,leverage:Be,createdAt:(new Date).toISOString()
      };
      me(o),Ae(!0),Ze(`\u2705 Demo account created locally! ID: ${
        r
      }`,'success'),setTimeout(()=>{
        Ae(!1),pe(''),Ce(1e4)
      },2500)
    }
  },Yr=ye.filter(e=>'DEMO'===e.type);
  return(0,L.jsxs)(d.default,{
    style:[o.container,{
      backgroundColor:r?'#000000':e.background,
      position:'relative'
    }],children:[

      (0,L.jsx)(C.default,{
      visible:Ge,message:Je,type:Ye,onHide:()=>Ke(!1)
    }),(0,L.jsxs)(d.default,{
      style:{
        flex:1,paddingTop:isEmbedded ? 0 : (Platform.OS === 'ios' && !B.isTelegram ? 47 : (0,B.getTgSafeAreaTop)()),backgroundColor:'transparent'
      },children:[null===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },showsVerticalScrollIndicator:!1,children:[Nr('Pro Hub',0,!1),(0,L.jsx)(f.default,{
          onPress:()=>le('broker_list'),activeOpacity:.9,style:{
            marginBottom:20
          },children:(0,L.jsxs)(F.LinearGradient,{
            colors:r?['rgba(59,130,246,0.15)','rgba(30,58,138,0.15)']:['#E0E7FF','#C7D2FE'],style:{
              borderRadius:24,padding:28,paddingVertical:32,borderWidth:1,borderColor:r?'rgba(59,130,246,0.3)':'#A5B4FC',shadowColor:r?'#3B82F6':'#4338CA',shadowOffset:{
                width:0,height:10
              },shadowOpacity:.3,shadowRadius:20
            },children:[(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',alignItems:'center',marginBottom:16
              },children:[(0,L.jsx)(d.default,{
                style:{
                  backgroundColor:'rgba(99,102,241,0.2)',padding:16,borderRadius:20,marginRight:18
                },children:(0,L.jsx)(v.ShieldAlert,{
                  color:"#818CF8",size:40
                })
              }),(0,L.jsxs)(d.default,{
                style:{
                  flex:1
                },children:[(0,L.jsx)(c.default,{
                  style:{
                    color:r?'#BFDBFE':'#312E81',fontSize:28,fontWeight:'900'
                  },children:"Find Broker"
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:r?'#60A5FA':'#4338CA',fontSize:15,marginTop:4
                  },children:"Compare & review top Forex brokers"
                })]
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',paddingTop:12,borderTopWidth:1,borderTopColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:r?'#818CF8':'#4F46E5',fontSize:12,fontWeight:'700'
                },children:"\u2b50  Ratings & Reviews"
              }),(0,L.jsx)(c.default,{
                style:{
                  color:r?'#818CF8':'#4F46E5',fontSize:12,fontWeight:'700'
                },children:"\ud83d\udcca Spread Comparison"
              })]
            })]
          })
        }),(0,L.jsx)(f.default,{
          onPress:()=>le('chat_groups'),activeOpacity:.9,style:{
            marginBottom:20
          },children:(0,L.jsxs)(F.LinearGradient,{
            colors:r?['rgba(16,185,129,0.15)','rgba(6,78,59,0.15)']:['#D1FAE5','#A7F3D0'],style:{
              borderRadius:24,padding:28,paddingVertical:32,borderWidth:1,borderColor:r?'rgba(16,185,129,0.3)':'#6EE7B7',shadowColor:'#10B981',shadowOffset:{
                width:0,height:10
              },shadowOpacity:.3,shadowRadius:20
            },children:[(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',alignItems:'center',marginBottom:16
              },children:[(0,L.jsx)(d.default,{
                style:{
                  backgroundColor:'rgba(16,185,129,0.2)',padding:16,borderRadius:20,marginRight:18
                },children:(0,L.jsx)(v.Briefcase,{
                  color:"#059669",size:40
                })
              }),(0,L.jsxs)(d.default,{
                style:{
                  flex:1
                },children:[(0,L.jsx)(c.default,{
                  style:{
                    color:r?'#A7F3D0':'#064E3B',fontSize:28,fontWeight:'900'
                  },children:"Forex Community"
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:r?'#34D399':'#047857',fontSize:15,marginTop:4
                  },children:"Join institutional chat groups"
                })]
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',paddingTop:12,borderTopWidth:1,borderTopColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:r?'#34D399':'#059669',fontSize:12,fontWeight:'700'
                },children:"\ud83d\udcac Live Chat Rooms"
              }),(0,L.jsx)(c.default,{
                style:{
                  color:r?'#34D399':'#059669',fontSize:12,fontWeight:'700'
                },children:"\ud83d\udc65 Signal Groups"
              })]
            })]
          })
        }),(0,L.jsx)(f.default,{
          onPress:()=>le('demo_account'),activeOpacity:.9,style:{
            marginBottom:20
          },children:(0,L.jsx)(d.default,{
            style:{
              backgroundColor:r?'#000000':'#FFFFFF',borderRadius:20,padding:16,borderWidth:1,borderColor:r?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'
            },children:(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',alignItems:'center'
              },children:[(0,L.jsx)(d.default,{
                style:{
                  backgroundColor:r?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',padding:10,borderRadius:14,marginRight:16
                },children:(0,L.jsx)(v.UserPlus,{
                  color:r?'#FFFFFF':'#000000',size:24
                })
              }),(0,L.jsxs)(d.default,{
                style:{
                  flex:1
                },children:[(0,L.jsx)(c.default,{
                  style:{
                    color:e.text,fontSize:18,fontWeight:'bold'
                  },children:"Demo Account"
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontSize:13,marginTop:2
                  },children:"Create & manage practice accounts"
                })]
              })]
            })
          })
        }),(0,L.jsx)(f.default,{
          onPress:()=>le('tools_hub'),activeOpacity:.9,children:(0,L.jsxs)(F.LinearGradient,{
            colors:r?['#4C1D95','#5B21B6']:['#EDE9FE','#DDD6FE'],style:{
              borderRadius:20,padding:16,borderWidth:1,borderColor:r?'#8B5CF6':'#C4B5FD',alignItems:'center',flexDirection:'row',justifyContent:'center'
            },children:[(0,L.jsx)(v.Layers,{
              color:r?'#C4B5FD':'#5B21B6',size:24,style:{
                marginRight:12
              }
            }),(0,L.jsx)(c.default,{
              style:{
                color:r?'#EDE9FE':'#4C1D95',fontSize:18,fontWeight:'bold'
              },children:"Institutional Tools Hub"
            })]
          })
        })]
      }),'tools_hub'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },showsVerticalScrollIndicator:!1,children:[Nr('Tools Hub',0,!0),(0,L.jsxs)(d.default,{
          style:o.grid,children:[(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('liquidity'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Activity,{
                  color:"#F87171",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Liquidity Map"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"DoM & Stops"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('heatmap'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Layers,{
                  color:"#34D399",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Market Screener"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Live Heatmap"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('smc'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Layers,{
                  color:"#A78BFA",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"SMC Scanner"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Order Blocks"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('mtf'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Target,{
                  color:"#60A5FA",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Trend Matrix"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Timeframe Align"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('analytics'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Briefcase,{
                  color:"#FBBF24",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Portfolio Stats"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"In-depth Performance"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('analysis'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.BarChart3,{
                  color:"#F472B6",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Tech Analysis"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"RSI, MACD, EMA"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('AiStudio'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Sparkles,{
                  color:"#E879F9",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"AI Studio"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Bots · Indicators"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('Replay'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Swords,{
                  color:"#FB7185",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Replay"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"You vs Bot"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('Library'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Trophy,{
                  color:"#F5A623",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Strategy Library"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Leaderboard"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('TradeDna'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Dna,{
                  color:"#A78BFA",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Trade DNA"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Your Patterns"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('Bots'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Bot,{
                  color:"#34D399",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Trading Bots"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"AI Strategies"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>l.navigate('NewsRadar'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.Calendar,{
                  color:"#38BDF8",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"News Radar"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Macro Events"
              })]
            })
          }),(0,L.jsx)(d.default,{
            style:o.gridItem,children:(0,L.jsxs)(O,{
              onPress:()=>le('risk_calc'),style:o.dashboardCard,children:[(0,L.jsx)(d.default,{
                style:[o.iconCircle,{
                  backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                }],children:(0,L.jsx)(v.ShieldAlert,{
                  color:"#F472B6",size:26
                })
              }),(0,L.jsx)(c.default,{
                numberOfLines:1,adjustsFontSizeToFit:true,style:o.cardTitle,children:"Risk Calc"
              }),(0,L.jsx)(c.default,{
                style:o.cardDesc,children:"Lot Sizing"
              })]
            })
          })]
        }),(0,L.jsxs)(d.default,{
          style:{
            marginTop:16,gap:16
          },children:[(0,L.jsxs)(O,{
            onPress:()=>le('manager'),style:o.wideCard,children:[(0,L.jsxs)(d.default,{
              style:o.wideCardContent,children:[(0,L.jsxs)(d.default,{
                style:o.wideCardLeft,children:[(0,L.jsx)(d.default,{
                  style:[o.iconCircle,{
                    backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',marginBottom:0
                  }],children:(0,L.jsx)(v.Cpu,{
                    color:"#FBBF24",size:26
                  })
                }),(0,L.jsxs)(d.default,{
                  style:{
                    marginLeft:16
                  },children:[(0,L.jsx)(c.default,{
                    style:[o.cardTitle,{
                      fontSize:18
                    }],children:"Trade Auto-Manager"
                  }),(0,L.jsx)(c.default,{
                    style:o.cardDesc,children:"Auto BE & Partial Close Engine"
                  })]
                })]
              }),(0,L.jsx)(v.ChevronRight,{
                color:"#94A3B8",size:22
              })]
            })]
          })]
        }),(0,L.jsx)(d.default,{
          style:{
            height:100
          }
        })]
      }),'broker_list'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Find Broker',0,!0),
          X.filter(t=>t.isPromoted).length>0&&(0,L.jsxs)(d.default,{
            style:{
              marginBottom:16
            },children:[
              (0,L.jsx)(c.default,{
                style:{
                  color:e.text,
                  fontSize:16,
                  fontWeight:'800',
                  marginBottom:12,
                  marginTop:4
                },children: "⭐ Featured / Promoted"
              }),
              X.filter(t=>t.isPromoted).map(t=>(0,L.jsx)(f.default,{
                onPress:()=>{
                  se(t),le('broker_details')
                },activeOpacity:.8,style:{
                  marginBottom:8
                },children:(0,L.jsx)(d.default,{
                  style:{
                    borderRadius:16,
                    overflow:'hidden',
                    borderWidth:1,
                    borderColor:'rgba(168, 85, 247, 0.35)'
                  },children:(0,L.jsx)(F.LinearGradient,{
                    colors:['rgba(168, 85, 247, 0.15)','rgba(168, 85, 247, 0.03)'],
                    start:{x:0,y:0},
                    end:{x:1,y:1},
                    children:(0,L.jsxs)(T.BlurView,{
                      intensity:r?30:80,
                      tint:e.blurTint,
                      style:{
                        paddingHorizontal:16,
                        paddingVertical:16,
                        flexDirection:'column',
                        alignItems:'stretch',
                        borderWidth:0
                      },children:[
                        (0,L.jsxs)(d.default,{
                          style:{
                            flexDirection:'row',
                            alignItems:'center'
                          },children:[
                            (0,L.jsx)(d.default,{
                              style:{
                                width:44,
                                height:44,
                                borderRadius:14,
                                backgroundColor:'rgba(168, 85, 247, 0.15)',
                                borderWidth:1,
                                borderColor:'rgba(168, 85, 247, 0.25)',
                                alignItems:'center',
                                justifyContent:'center',
                                marginRight:16
                              },children:P(t.logoUrl)?(0,L.jsx)(j.default,{
                                source:{
                                  uri:P(t.logoUrl)
                                },style:{
                                  width:44,height:44,borderRadius:14
                                }
                              }):(0,L.jsx)(c.default,{
                                style:{
                                  color:'#C084FC',
                                  fontWeight:'900',
                                  fontSize:18
                                },children:t.name[0]
                              })
                            }),
                            (0,L.jsxs)(d.default,{
                              style:{
                                flex:1
                              },children:[
                                (0,L.jsxs)(d.default,{
                                  style:{
                                    flexDirection:'row',
                                    alignItems:'center'
                                  },children:[
                                    (0,L.jsx)(c.default,{
                                      style:{
                                        color:e.text,
                                        fontSize:17,
                                        fontWeight:'800'
                                      },children:t.name
                                    }),
                                    (0,L.jsx)(d.default,{
                                      style:{
                                        backgroundColor:'rgba(168, 85, 247, 0.15)',
                                        borderWidth:1,
                                        borderColor:'rgba(168, 85, 247, 0.3)',
                                        paddingHorizontal:6,
                                        paddingVertical:2,
                                        borderRadius:6,
                                        marginLeft:8
                                      },children:(0,L.jsx)(c.default,{
                                        style:{
                                          color:'#C084FC',
                                          fontWeight:'700',
                                          fontSize:9
                                        },children:"PROMOTED"
                                      })
                                    })
                                  ]
                                }),
                                (0,L.jsxs)(d.default,{
                                  style:{
                                    flexDirection:'row',
                                    alignItems:'center',
                                    marginTop:6
                                  },children:[(0,L.jsx)(d.default,{
                                    style:{
                                      backgroundColor:r?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',
                                      borderWidth:1,
                                      borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',
                                      paddingHorizontal:8,
                                      paddingVertical:2,
                                      borderRadius:8,
                                      marginRight:8
                                    },children:(0,L.jsxs)(c.default,{
                                      style:{
                                        color:e.textMuted,
                                        fontSize:11,
                                        fontWeight:'600'
                                      },children:["Reg: ",t.reg]
                                    })
                                  })]
                                })
                              ]
                            }),
                            (0,L.jsxs)(d.default,{
                              style:{
                                alignItems:'flex-end'
                              },children:[(0,L.jsx)(d.default,{
                                style:{
                                  flexDirection:'row',
                                  alignItems:'center',
                                  backgroundColor:'rgba(59,130,246,0.12)',
                                  borderWidth:1,
                                  borderColor:'rgba(59,130,246,0.2)',
                                  paddingHorizontal:8,
                                  paddingVertical:3,
                                  borderRadius:10
                                },children:(0,L.jsxs)(c.default,{
                                  style:{
                                    color:'#60A5FA',
                                    fontWeight:'800',
                                    fontSize:13
                                  },children:["\u2605 ",t.rating]
                                })
                              }),(0,L.jsxs)(c.default,{
                                style:{
                                  color:e.textMuted,
                                  fontSize:12,
                                  marginTop:8,
                                  fontWeight:'600'
                                },children:["Spreads: ",t.spreads]
                              })]
                            })
                          ]
                        }),
                        (0,L.jsx)(d.default,{
                          style:{
                            marginTop:12,
                            borderTopWidth:1,
                            borderTopColor:'rgba(168, 85, 247, 0.15)',
                            paddingTop:12
                          },children:(0,L.jsx)(f.default,{
                            onPress:()=>{
                              se(t),le('broker_details')
                            },activeOpacity:.9,style:{
                              backgroundColor:'rgba(168, 85, 247, 0.2)',
                              borderRadius:10,
                              paddingVertical:8,
                              alignItems:'center',
                              borderWidth:1,
                              borderColor:'rgba(168, 85, 247, 0.3)'
                            },children:(0,L.jsx)(c.default,{
                              style:{
                                color:'#C084FC',
                                fontWeight:'800',
                                fontSize:13
                              },children:"Details & Community"
                            })
                          })
                        })
                      ]
                    })
                  })
                })
              },t._id||t.id))
            ]
          }),
          X.filter(t=>!t.isPromoted).length>0&&(0,L.jsxs)(d.default,{
            children:[
              X.filter(t=>t.isPromoted).length>0&&(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,
                  fontSize:15,
                  fontWeight:'700',
                  marginBottom:12,
                  marginTop:16
                },children:"All Brokers"
              }),
              X.filter(t=>!t.isPromoted).map(t=>(0,L.jsx)(f.default,{
                onPress:()=>{
                  se(t),le('broker_details')
                },activeOpacity:.8,style:{
                  marginBottom:8
                },children:(0,L.jsx)(d.default,{
                  style:{
                    borderRadius:16,
                    overflow:'hidden',
                    borderWidth:1,
                    borderColor:e.glassCardBorder
                  },children:(0,L.jsx)(F.LinearGradient,{
                    colors:r?['rgba(255,255,255,0.02)','rgba(255,255,255,0.01)']:['rgba(255,255,255,0.45)','rgba(255,255,255,0.15)'],
                    start:{x:0,y:0},
                    end:{x:1,y:1},
                    children:(0,L.jsxs)(T.BlurView,{
                      intensity:r?30:80,
                      tint:e.blurTint,
                      style:{
                        paddingHorizontal:16,
                        paddingVertical:16,
                        flexDirection:'row',
                        alignItems:'center',
                        borderWidth:0
                      },children:[(0,L.jsx)(d.default,{
                        style:{
                          width:44,
                          height:44,
                          borderRadius:14,
                          backgroundColor:r?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',
                          borderWidth:1,
                          borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',
                          alignItems:'center',
                          justifyContent:'center',
                          marginRight:16
                        },children:P(t.logoUrl)?(0,L.jsx)(j.default,{
                          source:{
                            uri:P(t.logoUrl)
                          },style:{
                            width:44,height:44,borderRadius:14
                          }
                        }):(0,L.jsx)(c.default,{
                          style:{
                            color:e.text,
                            fontWeight:'900',
                            fontSize:18
                          },children:t.name[0]
                        })
                      }),(0,L.jsxs)(d.default,{
                        style:{
                          flex:1
                        },children:[(0,L.jsx)(c.default,{
                          style:{
                            color:e.text,
                            fontSize:17,
                            fontWeight:'800'
                          },children:t.name
                        }),(0,L.jsxs)(d.default,{
                          style:{
                            flexDirection:'row',
                            alignItems:'center',
                            marginTop:6
                          },children:[(0,L.jsx)(d.default,{
                            style:{
                              backgroundColor:r?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',
                              borderWidth:1,
                              borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',
                              paddingHorizontal:8,
                              paddingVertical:2,
                              borderRadius:8,
                              marginRight:8
                            },children:(0,L.jsxs)(c.default,{
                              style:{
                                color:e.textMuted,
                                fontSize:11,
                                fontWeight:'600'
                              },children:["Reg: ",t.reg]
                            })
                          })]
                        })]
                      }),(0,L.jsxs)(d.default,{
                        style:{
                          alignItems:'flex-end'
                        },children:[(0,L.jsx)(d.default,{
                          style:{
                            flexDirection:'row',
                            alignItems:'center',
                            backgroundColor:'rgba(59,130,246,0.12)',
                            borderWidth:1,
                            borderColor:'rgba(59,130,246,0.2)',
                            paddingHorizontal:8,
                            paddingVertical:3,
                            borderRadius:10
                          },children:(0,L.jsxs)(c.default,{
                            style:{
                              color:'#60A5FA',
                              fontWeight:'800',
                              fontSize:13
                            },children:["\u2605 ",t.rating]
                          })
                        }),(0,L.jsxs)(c.default,{
                          style:{
                            color:e.textMuted,
                            fontSize:12,
                            marginTop:8,
                            fontWeight:'600'
                          },children:["Spreads: ",t.spreads]
                        })]
                      })]
                    })
                  })
                })
              },t._id||t.id))
            ]
          })
        ]
      }),'broker_details'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Broker Details',0,!0),(0,L.jsxs)(O,{
          intensity:20,style:{
            padding:24,alignItems:'center',marginBottom:24
          },children:[(0,L.jsx)(d.default,{
            style:{
              width:80,height:80,borderRadius:40,backgroundColor:e.glassCard,alignItems:'center',justifyContent:'center',marginBottom:16
            },children:P(ie?.logoUrl)?(0,L.jsx)(j.default,{
              source:{
                uri:P(ie.logoUrl)
              },style:{
                width:80,height:80,borderRadius:40
              }
            }):(0,L.jsx)(c.default,{
              style:{
                color:e.text,fontWeight:'bold',fontSize:32
              },children:ie?.name[0]
            })
          }),(0,L.jsx)(c.default,{
            style:{
              color:e.text,fontSize:28,fontWeight:'bold'
            },children:ie?.name
          }),(0,L.jsx)(d.default,{
            style:{
              flexDirection:'row',alignItems:'center',marginTop:12,backgroundColor:'rgba(59,130,246,0.15)',borderWidth:1,borderColor:'rgba(59,130,246,0.3)',paddingHorizontal:12,paddingVertical:6,borderRadius:16
            },children:(0,L.jsxs)(c.default,{
              style:{
                color:'#60A5FA',fontWeight:'bold',fontSize:16
              },children:["\u2605 ",ie?.rating," Trust Score"]
            })
          })]
        }),ie?.hasCommunity&&ie?.communityName&&''!==ie.communityName.trim()&&(0,L.jsxs)(f.default,{
          onPress:()=>{
            jt(ie.communityName),le('community_chat')
          },style:{
            backgroundColor:'rgba(59,130,246,0.15)',borderRadius:16,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'center',marginBottom:24,borderWidth:1,borderColor:'rgba(59,130,246,0.3)'
          },children:[(0,L.jsx)(v.Users,{
            color:"#60A5FA",size:20,style:{
              marginRight:8
            }
          }),(0,L.jsx)(c.default,{
            style:{
              color:'#60A5FA',fontSize:16,fontWeight:'bold'
            },children:"Join Broker Community"
          })]
        }),(0,L.jsx)(c.default,{
          style:{
            color:e.text,fontSize:20,fontWeight:'bold',marginBottom:16
          },children:"Broker Specifications"
        }),(0,L.jsx)(d.default,{
          style:{
            backgroundColor:r?'rgba(255, 255, 255, 0.02)':'rgba(255, 255, 255, 0.8)',borderRadius:16,padding:16,marginBottom:24,borderWidth:1,borderColor:r?'rgba(255,255,255,0.08)':'rgba(15,23,42,0.08)',
            ...(!r ? {
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 10,
              elevation: 1
            } : {})
          },children:[{
            label:'Min Deposit',value:ie?.minDeposit
          },{
            label:'Max Leverage',value:ie?.maxLeverage
          },{
            label:'Spreads From',value:ie?.spreads
          },{
            label:'Regulation',value:ie?.reg
          },{
            label:'Platforms',value:ie?.platforms
          },{
            label:'Base Currencies',value:ie?.baseCurrencies
          }].map((t,o)=>(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',justifyContent:'space-between',paddingVertical:12,borderBottomWidth:o<5?1:0,borderBottomColor:r?'rgba(255,255,255,0.08)':'rgba(15,23,42,0.08)'
            },children:[(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,fontSize:15
              },children:t.label
            }),(0,L.jsx)(c.default,{
              style:{
                color:e.text,fontSize:15,fontWeight:'600'
              },children:t.value
            })]
          },o))
        }),(0,L.jsx)(c.default,{
          style:{
            color:e.text,fontSize:20,fontWeight:'bold',marginBottom:16
          },children:"Key Features"
        }),(0,L.jsx)(d.default,{
          style:{
            flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:24
          },children:ie?.features.map((e,t)=>(0,L.jsx)(d.default,{
            style:{
              backgroundColor:'rgba(59,130,246,0.2)',paddingHorizontal:16,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'rgba(59,130,246,0.4)'
            },children:(0,L.jsx)(c.default,{
              style:{
                color:'#93C5FD',fontWeight:'600'
              },children:e
            })
          },t))
        }),(0,L.jsx)(f.default,{
          activeOpacity:.9,style:{
            width:'100%',marginBottom:32
          },children:(0,L.jsx)(F.LinearGradient,{
            colors:['#3B82F6','#1D4ED8'],style:{
              paddingVertical:16,borderRadius:16,alignItems:'center',shadowColor:'#3B82F6',shadowOffset:{
                width:0,height:4
              },shadowOpacity:.3,shadowRadius:8
            },children:(0,L.jsx)(c.default,{
              style:{
                color:'#FFF',fontSize:18,fontWeight:'bold'
              },children:"Open Live Account"
            })
          })
        }),(0,L.jsx)(d.default,{
          style:{
            height:1,backgroundColor:e.glassCard,marginBottom:24
          }
        }),(0,L.jsx)(c.default,{
          style:{
            color:e.text,fontSize:20,fontWeight:'bold',marginBottom:16
          },children:"User Reviews & Comments"
        }),(0,L.jsxs)(d.default,{
          style:{
            marginBottom:24
          },children:[(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',alignItems:'center',backgroundColor:e.glassCard,borderRadius:20,paddingHorizontal:12,height:48,marginBottom:8
            },children:[(0,L.jsx)(x.default,{
              style:{
                flex:1,color:e.text,fontSize:15,height:48
              },placeholder:"Write a review about this broker...",placeholderTextColor:"#94A3B8"
            }),(0,L.jsx)(f.default,{
              onPress:()=>alert('Your review has been submitted and is pending admin approval.'),style:{
                backgroundColor:'#6366F1',paddingHorizontal:16,paddingVertical:8,borderRadius:14
              },children:(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontWeight:'bold'
                },children:"Submit"
              })
            })]
          }),(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',alignItems:'center',marginLeft:4
            },children:[(0,L.jsx)(v.ShieldAlert,{
              color:"#F59E0B",size:14,style:{
                marginRight:6
              }
            }),(0,L.jsx)(c.default,{
              style:{
                color:'#F59E0B',fontSize:12
              },children:"All comments must be approved by an Admin before appearing publicly."
            })]
          })]
        }),[{
          user:'@InstitutionalPro',text:'Been trading with them for 3 years. Excellent execution speed during news events.',rating:5,date:'2 days ago'
        },{
          user:'@SmartMoney',text:'Spreads are definitely raw, but their withdrawal takes 48 hours sometimes.',rating:4,date:'1 week ago'
        }].map((t,r)=>(0,L.jsxs)(d.default,{
          style:{
            backgroundColor:e.glassCard,padding:16,borderRadius:16,marginBottom:12
          },children:[(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',justifyContent:'space-between',marginBottom:8
            },children:[(0,L.jsx)(c.default,{
              style:{
                color:e.text,fontWeight:'bold',fontSize:15
              },children:t.user
            }),(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,fontSize:13
              },children:t.date
            })]
          }),(0,L.jsx)(d.default,{
            style:{
              flexDirection:'row',marginBottom:8
            },children:[...Array(5)].map((e,r)=>(0,L.jsx)(c.default,{
              style:{
                color:r<t.rating?'#60A5FA':'rgba(255,255,255,0.06)',fontSize:14,marginRight:2
              },children:"\u2605"
            },r))
          }),(0,L.jsx)(c.default,{
            style:{
              color:'#CBD5E1',fontSize:14,lineHeight:20
            },children:t.text
          })]
        },r)),(0,L.jsx)(d.default,{
          style:{
            height:40
          }
        })]
      }),'chat_groups'===oe&&(()=>{
        const t=['All','Official Brokers','VIP Signals','Strategies','Beginners'],o=ve.length>0?ve:[],l='Discover'===ue?'All'===de?o:o.filter(e=>e.category===de):o.filter(e=>fe.includes(e.name));
        o.slice(0,4);
        return(0,L.jsxs)(d.default,{
          style:{
            flex:1,padding:20,paddingTop:20
          },children:[(0,L.jsx)(b.default,{
            visible:Le,transparent:!0,animationType:"fade",onRequestClose:()=>Me(!1),children:(0,L.jsx)(d.default,{
              style:{
                flex:1,backgroundColor:'rgba(0,0,0,0.75)',justifyContent:'center',padding:20
              },children:(0,L.jsx)(T.BlurView,{
                intensity:30,tint:"dark",style:{
                  borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.1)'
                },children:(0,L.jsxs)(d.default,{
                  style:{
                    backgroundColor:e.glassCard,padding:24,borderRadius:28
                  },children:[(0,L.jsxs)(d.default,{
                    style:{
                      flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20
                    },children:[(0,L.jsx)(c.default,{
                      style:{
                        color:e.text,fontSize:20,fontWeight:'bold'
                      },children:"Create Dynamic Group"
                    }),(0,L.jsx)(f.default,{
                      onPress:()=>Me(!1),children:(0,L.jsx)(c.default,{
                        style:{
                          color:e.textMuted,fontSize:16
                        },children:"\u2715"
                      })
                    })]
                  }),(0,L.jsxs)(d.default,{
                    style:{
                      alignItems:'center',marginBottom:20
                    },children:[(0,L.jsx)(f.default,{
                      onPress:Sr,style:{
                        width:80,height:80,borderRadius:40,backgroundColor:'rgba(59,130,246,0.15)',borderWidth:1,borderColor:'#3B82F6',alignItems:'center',justifyContent:'center',overflow:'hidden'
                      },children:He?(0,L.jsx)(j.default,{
                        source:{
                          uri:He
                        },style:{
                          width:80,height:80
                        }
                      }):(0,L.jsx)(v.ImagePlus,{
                        color:"#60A5FA",size:28
                      })
                    }),(0,L.jsx)(c.default,{
                      style:{
                        color:e.textMuted,fontSize:12,marginTop:8
                      },children:"Tap to upload group avatar"
                    })]
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,marginBottom:6,marginLeft:4
                    },children:"Group Name *"
                  }),(0,L.jsx)(x.default,{
                    style:{
                      backgroundColor:'rgba(0,0,0,0.2)',color:e.text,paddingHorizontal:16,height:48,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginBottom:16
                    },placeholder:"e.g. Institutional Alpha",placeholderTextColor:"#64748B",value:Pe,onChangeText:Ee
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,marginBottom:6,marginLeft:4
                    },children:"Category"
                  }),(0,L.jsx)(g.default,{
                    horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
                      marginBottom:16,maxHeight:40
                    },children:t.filter(e=>'All'!==e).map(e=>(0,L.jsx)(f.default,{
                      onPress:()=>$e(e),style:{
                        backgroundColor:Ue===e?'#3B82F6':'rgba(255,255,255,0.04)',paddingHorizontal:14,paddingVertical:8,borderRadius:12,marginRight:8,borderWidth:1,borderColor:Ue===e?'#3B82F6':'rgba(255,255,255,0.06)'
                      },children:(0,L.jsx)(c.default,{
                        style:{
                          color:Ue===e?'#FFF':'#94A3B8',fontSize:12,fontWeight:'bold'
                        },children:e
                      })
                    },e))
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,marginBottom:6,marginLeft:4
                    },children:"Description"
                  }),(0,L.jsx)(x.default,{
                    style:{
                      backgroundColor:'rgba(0,0,0,0.2)',color:e.text,paddingHorizontal:16,paddingVertical:12,height:80,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginBottom:24
                    },placeholder:"Brief description about trading concepts discussed...",placeholderTextColor:"#64748B",multiline:!0,textAlignVertical:"top",value:Oe,onChangeText:Ve
                  }),(0,L.jsx)(f.default,{
                    onPress:()=>Cr(Pe,Oe,Ue,He),style:{
                      backgroundColor:'#3B82F6',paddingVertical:14,borderRadius:16,alignItems:'center',shadowColor:'#3B82F6',shadowOffset:{
                        width:0,height:4
                      },shadowOpacity:.3,shadowRadius:8
                    },children:(0,L.jsx)(c.default,{
                      style:{
                        color:'#FFF',fontSize:16,fontWeight:'bold'
                      },children:"Confirm & Create Group"
                    })
                  })]
                })
              })
            })
          }),!B.isTelegram&&initialActiveTool!=='chat_groups'&&(0,L.jsxs)(f.default,{
            onPress:()=>{ if (oe === initialActiveTool && onBack) { onBack(); } else { le(null); } },style:{
              flexDirection:'row',alignItems:'center',marginBottom:16
            },children:[(0,L.jsx)(v.ArrowLeft,{
              color:"#60A5FA",size:24
            }),(0,L.jsx)(c.default,{
              style:{
                color:'#60A5FA',fontSize:16,fontWeight:'bold',marginLeft:8
              },children:"Back"
            })]
          }),'admin'===De&&(0,L.jsx)(f.default,{
            onPress:()=>Me(!0),style:{
              backgroundColor:'#3B82F6',flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:12,borderRadius:16,marginBottom:16
            },children:(0,L.jsx)(c.default,{
              style:{
                color:'#FFF',fontSize:16,fontWeight:'bold'
              },children:"+ Create New Group"
            })
          }),(0,L.jsxs)(g.default,{
            showsVerticalScrollIndicator:!1,contentContainerStyle:{
              paddingBottom:100
            },children:[initialActiveTool!=='chat_groups'&&(0,L.jsx)(c.default,{
              style:{
                color:e.text,fontSize:32,fontWeight:'900',marginBottom:4
              },children:"Communities"
            }),initialActiveTool!=='chat_groups'&&(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,fontSize:15,marginBottom:20
              },children:"Join institutional chat rooms"
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',backgroundColor:r?e.glassCard:'#FFFFFF',borderRadius:16,padding:4,marginBottom:24,borderWidth:1,borderColor:r?e.glassCardBorder:'rgba(0,0,0,0.06)'
              },children:[(0,L.jsx)(f.default,{
                onPress:()=>ge('Discover'),style:{
                  flex:1,paddingVertical:10,borderRadius:12,backgroundColor:'Discover'===ue?'rgba(59,130,246,0.15)':'transparent',alignItems:'center'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:'Discover'===ue?'#60A5FA':e.textMuted,fontWeight:'bold'
                  },children:"Discover"
                })
              }),(0,L.jsx)(f.default,{
                onPress:()=>ge('My Groups'),style:{
                  flex:1,paddingVertical:10,borderRadius:12,backgroundColor:'My Groups'===ue?'rgba(59,130,246,0.15)':'transparent',alignItems:'center'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:'My Groups'===ue?'#60A5FA':e.textMuted,fontWeight:'bold'
                  },children:"My Groups"
                })
              })]
            }),0===l.length?(0,L.jsxs)(d.default,{
              style:{
                alignItems:'center',marginTop:40
              },children:[(0,L.jsx)(v.Users,{
                color:e.textMuted,size:48,style:{
                  marginBottom:16
                }
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:16
                },children:"No groups found"
              })]
            }):l.map((t,o)=>(0,L.jsxs)(f.default,{
              onPress:()=>{
                jt(t.name),le('community_chat')
              },style:{
                backgroundColor:r?'rgba(255,255,255,0.02)':'#FFFFFF',borderRadius:20,padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:r?'rgba(255,255,255,0.08)':'rgba(15,23,42,0.06)',
                ...(!r ? {
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  elevation: 1
                } : {})
              },children:[(0,L.jsx)(d.default,{
                style:{
                  width:56,height:56,borderRadius:28,backgroundColor:t.iconColor||'rgba(59,130,246,0.15)',alignItems:'center',justifyContent:'center',marginRight:16,borderWidth:1,borderColor:'#3B82F6'
                },children:P(t.imageUrl)?(0,L.jsx)(j.default,{
                  source:{
                    uri:P(t.imageUrl)
                  },style:{
                    width:56,height:56,borderRadius:28
                  }
                }):(0,L.jsx)(c.default,{
                  style:{
                    color:'#60A5FA',fontSize:24,fontWeight:'bold'
                  },children:t.name.substring(0,2).toUpperCase()
                })
              }),(0,L.jsxs)(d.default,{
                style:{
                  flex:1
                },children:[(0,L.jsx)(c.default,{
                  style:{
                    color:e.text,fontSize:18,fontWeight:'bold'
                  },children:t.name
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontSize:13,marginTop:4
                  },numberOfLines:1,children:t.description||'Institutional discussion group'
                }),(0,L.jsxs)(d.default,{
                  style:{
                    flexDirection:'row',alignItems:'center',marginTop:8
                  },children:[(0,L.jsx)(v.Users,{
                    color:"#64748B",size:14,style:{
                      marginRight:4
                    }
                  }),(0,L.jsxs)(c.default,{
                    style:{
                      color:'#64748B',fontSize:12
                    },children:[t.memberCount||0," members"]
                  }),fe.includes(t.name)&&(0,L.jsx)(d.default,{
                    style:{
                      backgroundColor:'rgba(59,130,246,0.15)',paddingHorizontal:6,paddingVertical:2,borderRadius:6,marginLeft:8
                    },children:(0,L.jsx)(c.default,{
                      style:{
                        color:'#60A5FA',fontSize:10,fontWeight:'bold'
                      },children:"JOINED"
                    })
                  })]
                })]
              })]
            },t._id||o))]
          })]
        })
      })(),'community_chat'===oe&&(0,L.jsx)(ChatScreen,{
        roomName:pt,
        communities:ve,
        joinedRooms:fe,
        currentUserId:Ie,
        currentUserAliases:Fe,
        userRole:De,
        isDark:r,
        colors:e,
        onBack:()=>le('chat_groups'),
        onProfile:()=>le('community_profile'),
        onJoin:async(roomName)=>{
          he(e=>[...e,roomName]);
          _e(e=>e.map(e=>e.name===roomName?Object.assign({},e,{
            isMember:!0,memberCount:(e.memberCount||0)+1
          }):e));
          const t=await(0,k.getItemAsync)('accessToken');
          t&&Jt.current&&Jt.current.emit('joinCommunity',{
            room:roomName,token:t
          });
          (0,k.getItemAsync)('cached_community_groups').then(t=>{
            if(t)try{
              const o=JSON.parse(t).map(t=>t.name===roomName?Object.assign({},t,{
                isMember:!0,memberCount:(t.memberCount||0)+1
              }):t);
              (0,k.setItemAsync)('cached_community_groups',JSON.stringify(o))
            }catch(e){}
          });
        }
      }),'community_profile'===oe&&(()=>{
        const t=ve.find(e=>e.name===pt),desc=t?.description||'Institutional discussion group',o=P(t?.imageUrl);
        return(0,L.jsxs)(d.default,{
          style:{
            flex:1,backgroundColor:e.background
          },children:[(0,L.jsx)(F.LinearGradient,{
            colors:r?['#000000','#000000']:['#FFFFFF','#FFFFFF'],style:u.default.absoluteFillObject
          }),(0,L.jsxs)(d.default,{
            style:{
              paddingTop:20,paddingHorizontal:16,paddingBottom:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'
            },children:[B.isTelegram ? (0,L.jsx)(d.default,{}) : (0,L.jsx)(f.default,{
              onPress:()=>le('community_chat'),children:(0,L.jsx)(v.ArrowLeft,{
                color:e.text,size:24
              })
            }),(0,L.jsx)(f.default,{
              children:(0,L.jsx)(v.MoreVertical,{
                color:e.text,size:24
              })
            })]
          }),(0,L.jsxs)(g.default,{
            showsVerticalScrollIndicator:!1,contentContainerStyle:{
              paddingBottom:40
            },children:[(0,L.jsxs)(d.default,{
              style:{
                alignItems:'center',marginTop:10
              },children:[(0,L.jsx)(d.default,{
                style:{
                  width:96,height:96,borderRadius:48,backgroundColor:t?.iconColor||'#1E293B',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#3B82F6',marginBottom:16,overflow:'hidden'
                },children:o?(0,L.jsx)(j.default,{
                  source:{
                    uri:o
                  },style:{
                    width:96,height:96,borderRadius:48
                  }
                }):(0,L.jsx)(v.Briefcase,{
                  color:"#60A5FA",size:40
                })
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:22,fontWeight:'bold'
                },children:pt
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:14,marginTop:6
                },children:t?`${
                  t.memberCount||0
                } members`:'0 members'
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,marginTop:24
              },children:[(0,L.jsxs)(f.default,{
                style:{
                  flex:1,backgroundColor:'rgba(59,130,246,0.15)',borderRadius:16,paddingVertical:12,alignItems:'center',marginRight:10
                },onPress:()=>le('community_chat'),children:[(0,L.jsx)(v.MessageCircle,{
                  color:"#60A5FA",size:24
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:'#60A5FA',fontSize:13,fontWeight:'600',marginTop:6
                  },children:"Message"
                })]
              }),(0,L.jsxs)(f.default,{
                style:{
                  flex:1,backgroundColor:e.glassCard,borderRadius:16,paddingVertical:12,alignItems:'center',marginRight:10
                },children:[(0,L.jsx)(v.BellOff,{
                  color:"#94A3B8",size:24
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontSize:13,fontWeight:'600',marginTop:6
                  },children:"Mute"
                })]
              }),(0,L.jsxs)(f.default,{
                style:{
                  flex:1,backgroundColor:'rgba(239,68,68,0.1)',borderRadius:16,paddingVertical:12,alignItems:'center'
                },onPress:async()=>{
                  he(e=>e.filter(e=>e!==pt)),_e(e=>e.map(e=>e.name===pt?Object.assign({
                    
                  },e,{
                    isMember:!1,memberCount:Math.max(0,(e.memberCount||1)-1)
                  }):e));
                  const e=await(0,k.getItemAsync)('accessToken');
                  Jt.current&&e&&Jt.current.emit('leaveCommunity',{
                    room:pt,token:e
                  }),(0,k.getItemAsync)('cached_community_groups').then(e=>{
                    if(e)try{
                      const t=JSON.parse(e).map(e=>e.name===pt?Object.assign({
                        
                      },e,{
                        isMember:!1,memberCount:Math.max(0,(e.memberCount||1)-1)
                      }):e);
                      (0,k.setItemAsync)('cached_community_groups',JSON.stringify(t))
                    }catch(e){
                      
                    }
                  }),le('chat_groups')
                },children:[(0,L.jsx)(v.LogOut,{
                  color:"#EF4444",size:24
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:'#EF4444',fontSize:13,fontWeight:'600',marginTop:6
                  },children:"Leave"
                })]
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                backgroundColor:e.glassCard,marginHorizontal:20,marginTop:24,borderRadius:20,padding:20
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:16,lineHeight:24
                },children:desc
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:12,marginTop:12
                },children:"Description"
              }),(0,L.jsx)(d.default,{
                style:{
                  height:1,backgroundColor:e.glassCard,marginVertical:16
                }
              }),(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',justifyContent:'space-between',alignItems:'center'
                },children:[(0,L.jsxs)(d.default,{
                  children:[(0,L.jsxs)(c.default,{
                    style:{
                      color:e.text,fontSize:16
                    },children:["@",pt.replace(/\s+/g,'')]
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,marginTop:4
                    },children:"Group Username"
                  })]
                }),(0,L.jsx)(v.QrCode,{
                  color:"#94A3B8",size:24
                })]
              })]
            }),'admin'===De&&(0,L.jsxs)(d.default,{
              style:{
                marginHorizontal:20,marginTop:12,backgroundColor:'rgba(168,85,247,0.08)',borderRadius:20,padding:20,borderWidth:1,borderColor:'rgba(168,85,247,0.2)'
              },children:[(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',alignItems:'center',marginBottom:16
                },children:[(0,L.jsx)(v.Link,{
                  color:"#A855F7",size:20
                }),(0,L.jsx)(c.default,{
                  style:{
                    color:'#A855F7',fontSize:16,fontWeight:'bold',marginLeft:10
                  },children:"Link to Broker"
                })]
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:13,marginBottom:12
                },children:(()=>{
                  const e=X.find(e=>e.communityName===pt);
                  return e?`Currently linked to: ${
                    e.name
                  }`:'Not linked to any broker'
                })()
              }),(0,L.jsx)(g.default,{
                horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
                  marginBottom:12
                },children:X.map(t=>{
                  const r=t.communityName===pt;
                  return(0,L.jsx)(f.default,{
                    onPress:async()=>{
                      fr(!0);
                      try{
                        const e=await(0,k.getItemAsync)('accessToken');
                        if(!e)return;
                        if(r)await z.default.put(`${
                          B.BACKEND_URL
                        }/api/v1/admin/brokers/${
                          t._id
                        }`,{
                          communityName:'',hasCommunity:!1
                        },{
                          headers:{
                            Authorization:`Bearer ${
                              e
                            }`
                          }
                        }),ee(e=>e.map(e=>e._id===t._id?Object.assign({
                          
                        },e,{
                          communityName:'',hasCommunity:!1
                        }):e));
                        else{
                          const r=X.find(e=>e.communityName===pt&&e._id!==t._id);
                          r&&await z.default.put(`${
                            B.BACKEND_URL
                          }/api/v1/admin/brokers/${
                            r._id
                          }`,{
                            communityName:'',hasCommunity:!1
                          },{
                            headers:{
                              Authorization:`Bearer ${
                                e
                              }`
                            }
                          }),await z.default.put(`${
                            B.BACKEND_URL
                          }/api/v1/admin/brokers/${
                            t._id
                          }`,{
                            communityName:pt,hasCommunity:!0
                          },{
                            headers:{
                              Authorization:`Bearer ${
                                e
                              }`
                            }
                          }),ee(e=>e.map(e=>e._id===t._id?Object.assign({
                            
                          },e,{
                            communityName:pt,hasCommunity:!0
                          }):r&&e._id===r._id?Object.assign({
                            
                          },e,{
                            communityName:'',hasCommunity:!1
                          }):e))
                        }p.default.alert('Success',r?`Unlinked from ${
                          t.name
                        }`:`Linked to ${
                          t.name
                        }`)
                      }catch(e){
                        p.default.alert('Error',e?.response?.data?.message||'Failed')
                      }fr(!1)
                    },style:{
                      backgroundColor:r?'rgba(168,85,247,0.3)':'rgba(255,255,255,0.05)',borderWidth:1,borderColor:r?'#A855F7':'rgba(255,255,255,0.1)',borderRadius:12,paddingHorizontal:14,paddingVertical:8,marginRight:8,flexDirection:'row',alignItems:'center'
                    },children:(0,L.jsxs)(c.default,{
                      style:{
                        color:r?'#A855F7':e.textMuted,fontWeight:r?'bold':'400',fontSize:13
                      },children:[r?'\u2713 ':'',t.name]
                    })
                  },t._id)
                })
              }),gr&&(0,L.jsx)(h.default,{
                color:"#A855F7",size:"small"
              })]
            }),(0,L.jsxs)(f.default,{
              style:{
                backgroundColor:e.glassCard,marginHorizontal:20,marginTop:12,borderRadius:20,padding:16,flexDirection:'row',alignItems:'center'
              },children:[(0,L.jsx)(v.UserPlus,{
                color:"#60A5FA",size:22
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:16,fontWeight:'500',marginLeft:16
                },children:"Add Members"
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',paddingHorizontal:20,marginTop:24,marginBottom:12
              },children:[(0,L.jsx)(d.default,{
                style:{
                  backgroundColor:'#1E293B',borderRadius:16,paddingHorizontal:16,paddingVertical:8,marginRight:12
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:'#60A5FA',fontWeight:'bold'
                  },children:"Members"
                })
              }),(0,L.jsx)(d.default,{
                style:{
                  paddingHorizontal:12,paddingVertical:8,marginRight:12
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontWeight:'600'
                  },children:"Media"
                })
              }),(0,L.jsx)(d.default,{
                style:{
                  paddingHorizontal:12,paddingVertical:8,marginRight:12
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontWeight:'600'
                  },children:"Saved"
                })
              }),(0,L.jsx)(d.default,{
                style:{
                  paddingHorizontal:12,paddingVertical:8,marginRight:12
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:e.textMuted,fontWeight:'600'
                  },children:"Files"
                })
              })]
            }),0===Mt.length?(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,textAlign:'center',marginTop:20
              },children:"Loading members..."
            }):Mt.map((t,r)=>{
              const o=Et.some(e=>e._id===t._id),l=('admin'===De||Et.some(e=>e._id===Ie))&&t._id!==Ie&&('admin'===De||!o);
              return(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:12
                },children:[(0,L.jsx)(d.default,{
                  style:{
                    width:48,height:48,borderRadius:24,backgroundColor:`hsla(${
                      50*r+150
                    }, 60%, 50%, 0.2)`,alignItems:'center',justifyContent:'center',marginRight:16,overflow:'hidden'
                  },children:t.avatarUrl&&'default'!==t.avatarUrl?(0,L.jsx)(j.default,{
                    source:{
                      uri:t.avatarUrl
                    },style:{
                      width:48,height:48
                    }
                  }):(0,L.jsx)(c.default,{
                    style:{
                      color:`hsl(${
                        50*r+150
                      }, 60%, 60%)`,fontWeight:'bold',fontSize:18
                    },children:t.username?.[0]?.toUpperCase()||'U'
                  })
                }),(0,L.jsxs)(d.default,{
                  style:{
                    flex:1
                  },children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontSize:16,fontWeight:'600'
                    },children:t.username
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:t.isOnline?'#60A5FA':'#64748B',fontSize:13,marginTop:2
                    },children:t.isOnline?'online':'last seen recently'
                  })]
                }),o&&(0,L.jsx)(d.default,{
                  style:{
                    backgroundColor:'rgba(168,85,247,0.15)',paddingHorizontal:8,paddingVertical:4,borderRadius:6,marginRight:8
                  },children:(0,L.jsx)(c.default,{
                    style:{
                      color:'#A855F7',fontSize:12,fontWeight:'bold'
                    },children:"Admin"
                  })
                }),l&&(0,L.jsx)(f.default,{
                  onPress:()=>jr(t._id),style:{
                    padding:6,backgroundColor:'rgba(239,68,68,0.1)',borderRadius:6
                  },children:(0,L.jsx)(c.default,{
                    style:{
                      color:'#EF4444',fontSize:12,fontWeight:'bold'
                    },children:"Kick"
                  })
                })]
              },t._id||r)
            })]
          })]
        })
      })(),'liquidity'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Liquidity Map'),Q.map((t,r)=>(0,L.jsxs)(d.default,{
          style:{
            marginBottom:24
          },children:[(0,L.jsx)(c.default,{
            style:{
              color:e.text,fontSize:24,fontWeight:'900',marginBottom:16
            },children:t.symbol
          }),(0,L.jsxs)(O,{
            intensity:20,style:{
              padding:16
            },children:[t.pools.map((r,o)=>{
              const l=r.price>t.currentPrice;
              return(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',alignItems:'center',marginBottom:12
                },children:[(0,L.jsx)(c.default,{
                  style:{
                    width:60,color:e.textMuted,fontWeight:'700'
                  },children:r.price
                }),(0,L.jsxs)(d.default,{
                  style:{
                    flex:1,height:28,backgroundColor:e.glassCard,borderRadius:4,overflow:'hidden',justifyContent:'center'
                  },children:[(0,L.jsx)(d.default,{
                    style:{
                      position:'absolute',left:l?'auto':0,right:l?0:'auto',width:`${
                        r.strength
                      }%`,height:'100%',backgroundColor:'RED'===r.color?'rgba(239,68,68,0.4)':'rgba(16,185,129,0.4)'
                    }
                  }),(0,L.jsxs)(c.default,{
                    style:{
                      color:e.text,fontSize:11,fontWeight:'800',marginLeft:8,marginRight:8,alignSelf:l?'flex-end':'flex-start',zIndex:2
                    },children:[r.volume," - ",r.type]
                  })]
                })]
              },o)
            }),(0,L.jsx)(d.default,{
              style:{
                marginTop:12,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)',paddingTop:12,alignItems:'center'
              },children:(0,L.jsxs)(c.default,{
                style:{
                  color:'#60A5FA',fontWeight:'800'
                },children:["CURRENT PRICE: ",t.currentPrice]
              })
            })]
          })]
        },r)),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'heatmap'===oe&&(()=>{
        const e=[...'All'===ae?m:m.filter(e=>e.category===ae)].sort((e,t)=>Math.abs(t.change24h)-Math.abs(e.change24h));
        return(0,L.jsxs)(g.default,{
          contentContainerStyle:{
            padding:20
          },children:[Nr('Market Screener'),(0,L.jsx)(g.default,{
            horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
              marginBottom:20
            },children:['All','Crypto','Indices','Stocks','Commodities'].map(e=>(0,L.jsx)(f.default,{
              onPress:()=>ne(e),style:[o.filterChip,ae===e&&o.filterChipActive],children:(0,L.jsx)(c.default,{
                style:[o.filterChipText,ae===e&&o.filterChipTextActive],children:e
              })
            },e))
          }),(0,L.jsx)(d.default,{
            style:{
              flexDirection:'row',flexWrap:'wrap',gap:12
            },children:e.map((e,t)=>{
              const r=e.change24h>0,l=Math.min(Math.abs(e.change24h)/8,1),a=t<3;
              return(0,L.jsxs)(d.default,{
                style:[o.heatBlock,{
                  backgroundColor:r?`rgba(16,185,129,${
                    .15+.4*l
                  })`:`rgba(239,68,68,${
                    .15+.4*l
                  })`,borderColor:r?`rgba(16,185,129,${
                    .3+.5*l
                  })`:`rgba(239,68,68,${
                    .3+.5*l
                  })`,width:a?(M-52)/2:(M-64)/3,height:a?110:85
                }],children:[(0,L.jsx)(c.default,{
                  style:o.heatSymbol,children:e.symbol
                }),(0,L.jsxs)(d.default,{
                  style:{
                    flexDirection:'row',alignItems:'center'
                  },children:[r?(0,L.jsx)(v.TrendingUp,{
                    color:"#FFF",size:14
                  }):(0,L.jsx)(v.TrendingDown,{
                    color:"#FFF",size:14
                  }),(0,L.jsxs)(c.default,{
                    style:o.heatChange,children:[r?'+':'',e.change24h,"%"]
                  })]
                }),a&&(0,L.jsxs)(c.default,{
                  style:o.heatPrice,children:["$",e.price.toLocaleString()]
                })]
              },e.symbol)
            })
          }),(0,L.jsx)(d.default,{
            style:{
              height:60
            }
          })]
        })
      })(),'smc'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('SMC Scanner'),K.map(t=>(0,L.jsx)(d.default,{
          style:{
            marginBottom:16
          },children:(0,L.jsxs)(O,{
            intensity:30,style:o.analysisCard,children:[(0,L.jsxs)(d.default,{
              style:o.analysisHeader,children:[(0,L.jsx)(c.default,{
                style:o.analysisSymbol,children:t.symbol
              }),(0,L.jsx)(d.default,{
                style:[o.trendBadge,{
                  backgroundColor:'Active'===t.status?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.06)'
                }],children:(0,L.jsx)(c.default,{
                  style:[o.trendBadgeText,{
                    color:'Active'===t.status?'#34D399':'#94A3B8'
                  }],children:t.status
                })
              })]
            }),(0,L.jsx)(c.default,{
              style:{
                color:'#A78BFA',fontSize:18,fontWeight:'800',marginBottom:16
              },children:t.type
            }),(0,L.jsxs)(d.default,{
              style:{
                height:60,backgroundColor:e.glassCard,borderRadius:12,borderWidth:1,borderColor:e.glassBorder,justifyContent:'center',paddingHorizontal:16,marginBottom:16
              },children:[(0,L.jsx)(d.default,{
                style:{
                  position:'absolute',top:15,bottom:15,left:'30%',right:'40%',backgroundColor:'rgba(139,92,246,0.3)',borderRadius:4,borderWidth:1,borderColor:'#8B5CF6'
                }
              }),(0,L.jsx)(c.default,{
                style:{
                  position:'absolute',left:16,color:e.textMuted,fontSize:12
                },children:t.zone[0]
              }),(0,L.jsx)(c.default,{
                style:{
                  position:'absolute',right:16,color:e.textMuted,fontSize:12
                },children:t.zone[1]
              }),(0,L.jsx)(d.default,{
                style:{
                  alignSelf:'center',backgroundColor:'#FFF',paddingHorizontal:8,borderRadius:12,borderWidth:1,borderColor:'#334155'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:e.text,fontSize:10,fontWeight:'700'
                  },children:"LIQUIDITY ZONE"
                })
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',alignItems:'center'
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:12,fontWeight:'700',textTransform:'uppercase'
                },children:"Zone Strength"
              }),(0,L.jsxs)(c.default,{
                style:{
                  color:e.text,fontSize:16,fontWeight:'800'
                },children:[t.strength,"%"]
              })]
            })]
          })
        },t.id)),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'mtf'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Trend Matrix'),q.map(t=>{
          const r=100===t.score,l=-100===t.score;
          return(0,L.jsx)(d.default,{
            style:{
              marginBottom:16
            },children:(0,L.jsxs)(O,{
              intensity:30,style:[o.analysisCard,{
                borderColor:r?'#34D399':l?'#F87171':'rgba(255,255,255,0.06)'
              }],children:[(0,L.jsx)(F.LinearGradient,{
                colors:[r?'rgba(16,185,129,0.3)':l?'rgba(239,68,68,0.3)':'transparent','transparent'],style:o.cardGlow
              }),(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20
                },children:[(0,L.jsx)(c.default,{
                  style:o.analysisSymbol,children:t.symbol
                }),(0,L.jsx)(d.default,{
                  style:{
                    backgroundColor:e.glassCard,paddingHorizontal:12,paddingVertical:6,borderRadius:16,borderWidth:1,borderColor:e.glassBorder
                  },children:(0,L.jsxs)(c.default,{
                    style:{
                      color:e.text,fontSize:13,fontWeight:'800'
                    },children:["Score: ",t.score]
                  })
                })]
              }),(0,L.jsx)(d.default,{
                style:{
                  flexDirection:'row',justifyContent:'space-between'
                },children:[{
                  label:'15m',val:t.m15
                },{
                  label:'1H',val:t.h1
                },{
                  label:'4H',val:t.h4
                },{
                  label:'1D',val:t.d1
                }].map((t,r)=>(0,L.jsxs)(d.default,{
                  style:{
                    alignItems:'center',flex:1
                  },children:[(0,L.jsx)(d.default,{
                    style:{
                      width:44,height:44,borderRadius:22,backgroundColor:'rgba(0,0,0,0.2)',borderWidth:2,borderColor:1===t.val?'#34D399':-1===t.val?'#F87171':'#94A3B8',justifyContent:'center',alignItems:'center',marginBottom:8
                    },children:1===t.val?(0,L.jsx)(v.TrendingUp,{
                      color:"#34D399",size:16
                    }):-1===t.val?(0,L.jsx)(v.TrendingDown,{
                      color:"#F87171",size:16
                    }):(0,L.jsx)(v.Activity,{
                      color:"#94A3B8",size:16
                    })
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,fontWeight:'700'
                    },children:t.label
                  })]
                },r))
              })]
            })
          },t.symbol)
        }),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'analytics'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Portfolio Analytics'),(0,L.jsxs)(d.default,{
          style:o.accountRow,children:[(0,L.jsxs)(O,{
            intensity:35,style:[o.accountCard,{
              flex:1,marginRight:8
            }],children:[(0,L.jsx)(c.default,{
              style:o.accountLabel,children:"Balance"
            }),(0,L.jsxs)(c.default,{
              style:o.accountValue,children:["$",N?.balance?.toLocaleString()]
            })]
          }),(0,L.jsxs)(O,{
            intensity:35,style:[o.accountCard,{
              flex:1,marginLeft:8
            }],children:[(0,L.jsx)(c.default,{
              style:o.accountLabel,children:"Equity"
            }),(0,L.jsxs)(c.default,{
              style:[o.accountValue,{
                color:'#34D399'
              }],children:["$",N?.equity?.toLocaleString()]
            })]
          })]
        }),(0,L.jsx)(d.default,{
          style:{
            flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:24
          },children:[{
            label:'Win Rate',value:`${
              N?.winRate
            }%`,color:'#34D399'
          },{
            label:'Total Trades',value:N?.totalTrades,color:e.text
          },{
            label:'Profit Factor',value:N?.profitFactor,color:'#60A5FA'
          },{
            label:'Sharpe Ratio',value:N?.sharpeRatio,color:'#A78BFA'
          }].map((e,t)=>(0,L.jsxs)(O,{
            intensity:20,style:{
              padding:16,width:(M-52)/2
            },children:[(0,L.jsx)(c.default,{
              style:o.statLabel,children:e.label
            }),(0,L.jsx)(c.default,{
              style:{
                fontSize:20,fontWeight:'800',color:e.color
              },children:e.value
            })]
          },t))
        }),N&&N.equityCurve&&(0,L.jsxs)(O,{
          intensity:25,style:{
            padding:16,paddingBottom:24
          },children:[(0,L.jsx)(c.default,{
            style:{
              color:e.text,fontSize:20,fontWeight:'800',marginBottom:16
            },children:"Equity Growth"
          }),(0,L.jsx)(I.LineChart,{
            data:{
              labels:["M","T","W","T","F","S","S"],datasets:[{
                data:N.equityCurve
              }]
            },width:M-72,height:180,yAxisLabel:"",yAxisSuffix:"",withOuterLines:!1,withInnerLines:!1,chartConfig:{
              backgroundColor:'transparent',backgroundGradientFromOpacity:0,backgroundGradientToOpacity:0,decimalPlaces:0,color:(e=1)=>`rgba(59,130,246,${
                e
              })`,labelColor:()=>"rgba(148,163,184,1)"
            },bezier:!0,style:{
              marginLeft:-10
            }
          })]
        }),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'analysis'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Tech Analysis'),E.map(t=>{
          return(0,L.jsx)(d.default,{
            style:{
              marginBottom:16
            },children:(0,L.jsxs)(O,{
              intensity:30,style:o.analysisCard,children:[(0,L.jsx)(d.default,{
                style:o.analysisHeader,children:(0,L.jsx)(c.default,{
                  style:o.analysisSymbol,children:t.symbol
                })
              }),(0,L.jsxs)(d.default,{
                style:{
                  marginBottom:20
                },children:[(0,L.jsxs)(d.default,{
                  style:{
                    flexDirection:'row',justifyContent:'space-between',marginBottom:8
                  },children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontWeight:'600'
                    },children:"RSI"
                  }),(0,L.jsx)(c.default,{
                    style:{
                      fontWeight:'800',color:(r=t.rsi,r<=30?'#34D399':r>=70?'#F87171':'#94A3B8')
                    },children:t.rsi
                  })]
                }),(0,L.jsx)(d.default,{
                  style:{
                    height:8,backgroundColor:e.glassCard,borderRadius:4
                  },children:(0,L.jsx)(F.LinearGradient,{
                    colors:['#34D399','#FBBF24','#F87171'],start:{
                      x:0,y:0
                    },end:{
                      x:1,y:0
                    },style:{
                      height:'100%',borderRadius:4,width:`${
                        t.rsi
                      }%`
                    }
                  })
                })]
              }),(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,0.2)',padding:16,borderRadius:16
                },children:[(0,L.jsxs)(d.default,{
                  children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:11,fontWeight:'800',marginBottom:4
                    },children:"MACD"
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontWeight:'700'
                    },children:t.macdSignal
                  })]
                }),(0,L.jsxs)(d.default,{
                  style:{
                    alignItems:'flex-end'
                  },children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:11,fontWeight:'800',marginBottom:4
                    },children:"EMA 50"
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontWeight:'700'
                    },children:t.ema50
                  })]
                })]
              })]
            })
          },t.id);
          var r
        }),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'calendar'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('News Radar'),(0,L.jsx)(d.default,{
          style:{
            position:'absolute',left:26,top:120,bottom:40,width:2,backgroundColor:e.glassCard
          }
        }),$.map(t=>(0,L.jsxs)(d.default,{
          style:{
            flexDirection:'row',marginBottom:20
          },children:[(0,L.jsx)(d.default,{
            style:{
              width:14,height:14,borderRadius:7,backgroundColor:'HIGH'===t.impact?'#F87171':'#FBBF24',marginTop:24,zIndex:1
            }
          }),(0,L.jsx)(d.default,{
            style:{
              flex:1,marginLeft:24
            },children:(0,L.jsxs)(O,{
              intensity:30,style:{
                padding:20
              },children:[(0,L.jsx)(c.default,{
                style:{
                  fontSize:24,marginBottom:8
                },children:t.country
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:17,fontWeight:'700',marginBottom:12
                },children:t.event
              }),(0,L.jsxs)(c.default,{
                style:{
                  color:'#60A5FA',fontWeight:'700',marginBottom:12
                },children:["\u23f1 ",Hr(t.time)]
              }),(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',gap:24,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.04)',paddingTop:16
                },children:[(0,L.jsxs)(d.default,{
                  children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:11,fontWeight:'800',marginBottom:4
                    },children:"FORECAST"
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontWeight:'700'
                    },children:t.forecast
                  })]
                }),(0,L.jsxs)(d.default,{
                  children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:11,fontWeight:'800',marginBottom:4
                    },children:"PREVIOUS"
                  }),(0,L.jsx)(c.default,{
                    style:{
                      color:e.textMuted,fontWeight:'700'
                    },children:t.previous
                  })]
                })]
              })]
            })
          })]
        },t.id)),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'manager'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Trade Auto-Manager'),(0,L.jsxs)(O,{
          intensity:30,style:o.rcContainer,children:[(0,L.jsxs)(d.default,{
            style:o.rcInputGroup,children:[(0,L.jsx)(c.default,{
              style:o.rcLabel,children:"Symbol"
            }),(0,L.jsx)(x.default,{
              style:[o.rcInput,{
                backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
              }],placeholderTextColor:e.textMuted,value:it,onChangeText:st
            })]
          }),(0,L.jsxs)(d.default,{
            style:o.rcInputGroup,children:[(0,L.jsx)(c.default,{
              style:o.rcLabel,children:"Select Rule Type"
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',gap:12
              },children:[(0,L.jsx)(f.default,{
                style:[o.ruleBtn,{
                  backgroundColor:e.glassCard,borderColor:e.glassBorder
                },'BREAK_EVEN'===dt&&o.ruleBtnActive],onPress:()=>ct('BREAK_EVEN'),children:(0,L.jsx)(c.default,{
                  style:[o.ruleBtnText,'BREAK_EVEN'===dt&&o.ruleBtnTextActive],children:"Auto BE"
                })
              }),(0,L.jsx)(f.default,{
                style:[o.ruleBtn,{
                  backgroundColor:e.glassCard,borderColor:e.glassBorder
                },'PARTIAL_TP'===dt&&o.ruleBtnActive],onPress:()=>ct('PARTIAL_TP'),children:(0,L.jsx)(c.default,{
                  style:[o.ruleBtnText,'PARTIAL_TP'===dt&&o.ruleBtnTextActive],children:"Partial TP"
                })
              })]
            })]
          }),(0,L.jsxs)(d.default,{
            style:o.rcInputGroup,children:[(0,L.jsx)(c.default,{
              style:o.rcLabel,children:"Trigger (Pips Profit)"
            }),(0,L.jsx)(x.default,{
              style:[o.rcInput,{
                backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
              }],placeholderTextColor:e.textMuted,value:ut,onChangeText:gt,keyboardType:"numeric"
            })]
          }),'PARTIAL_TP'===dt&&(0,L.jsxs)(d.default,{
            style:o.rcInputGroup,children:[(0,L.jsx)(c.default,{
              style:o.rcLabel,children:"Close Volume (%)"
            }),(0,L.jsx)(x.default,{
              style:[o.rcInput,{
                backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
              }],placeholderTextColor:e.textMuted,value:ft,onChangeText:ht,keyboardType:"numeric"
            })]
          }),(0,L.jsx)(f.default,{
            onPress:Ur,disabled:yt,children:(0,L.jsx)(F.LinearGradient,{
              colors:['#F59E0B','#D97706'],style:o.rcBtnGradient,children:yt?(0,L.jsx)(h.default,{
                color:"#FFF"
              }):(0,L.jsx)(c.default,{
                style:o.rcBtnText,children:"Activate Server Rule"
              })
            })
          }),mt&&(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',alignItems:'center',backgroundColor:'rgba(16,185,129,0.1)',padding:16,borderRadius:16,marginTop:24,borderWidth:1,borderColor:'rgba(16,185,129,0.3)'
            },children:[(0,L.jsx)(v.Check,{
              color:"#34D399",size:20,style:{
                marginRight:8
              }
            }),(0,L.jsx)(c.default,{
              style:{
                color:'#D1FAE5',fontWeight:'600'
              },children:mt
            })]
          })]
        }),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'risk_calc'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20
        },children:[Nr('Risk Calculator'),(0,L.jsxs)(O,{
          intensity:30,style:o.rcContainer,children:[(0,L.jsxs)(d.default,{
            style:o.rcInputGroup,children:[(0,L.jsx)(c.default,{
              style:o.rcLabel,children:"Symbol"
            }),(0,L.jsx)(x.default,{
              style:[o.rcInput,{
                backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
              }],placeholderTextColor:e.textMuted,value:Rr,onChangeText:Dr
            })]
          }),(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',gap:16,marginBottom:24
            },children:[(0,L.jsxs)(d.default,{
              style:[o.rcInputGroup,{
                flex:1,marginBottom:0
              }],children:[(0,L.jsx)(c.default,{
                style:o.rcLabel,children:"Risk %"
              }),(0,L.jsx)(x.default,{
                style:[o.rcInput,{
                  backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
                }],placeholderTextColor:e.textMuted,value:Wr,onChangeText:vr,keyboardType:"numeric"
              })]
            }),(0,L.jsxs)(d.default,{
              style:[o.rcInputGroup,{
                flex:1,marginBottom:0
              }],children:[(0,L.jsx)(c.default,{
                style:o.rcLabel,children:"SL (Pips)"
              }),(0,L.jsx)(x.default,{
                style:[o.rcInput,{
                  backgroundColor:e.glassCard,color:e.text,borderColor:e.glassBorder
                }],placeholderTextColor:e.textMuted,value:_r,onChangeText:Lr,keyboardType:"numeric"
              })]
            })]
          }),(0,L.jsx)(f.default,{
            onPress:$r,disabled:Er,children:(0,L.jsx)(F.LinearGradient,{
              colors:['#EC4899','#8B5CF6'],style:o.rcBtnGradient,children:Er?(0,L.jsx)(h.default,{
                color:"#FFF"
              }):(0,L.jsx)(c.default,{
                style:o.rcBtnText,children:"Calculate Lot"
              })
            })
          }),Mr&&(0,L.jsxs)(d.default,{
            style:{
              marginTop:24,backgroundColor:'rgba(0,0,0,0.2)',borderRadius:20,padding:20,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'
            },children:[(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,textAlign:'center',marginBottom:8,fontWeight:'600'
              },children:"Volume"
            }),(0,L.jsxs)(c.default,{
              style:{
                color:e.text,fontSize:42,fontWeight:'900',textAlign:'center'
              },children:[Mr.lotSize," ",(0,L.jsx)(c.default,{
                style:{
                  fontSize:18,color:e.textMuted
                },children:"Lots"
              })]
            }),(0,L.jsx)(d.default,{
              style:{
                height:1,backgroundColor:e.glassCard,marginVertical:16
              }
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',marginBottom:10
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted
                },children:"Risk"
              }),(0,L.jsxs)(c.default,{
                style:{
                  color:'#F87171',fontWeight:'700'
                },children:["$",Mr.potentialLoss]
              })]
            }),(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between'
              },children:[(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted
                },children:"Equity"
              }),(0,L.jsxs)(c.default,{
                style:{
                  color:e.text,fontWeight:'700'
                },children:["$",Mr.equity]
              })]
            })]
          })]
        }),(0,L.jsx)(d.default,{
          style:{
            height:60
          }
        })]
      }),'demo_account'===oe&&(0,L.jsxs)(g.default,{
        contentContainerStyle:{
          padding:20,paddingBottom:80
        },showsVerticalScrollIndicator:!1,children:[!B.isTelegram&&(0,L.jsx)(d.default,{
          style:{
            marginBottom:24,alignSelf:'flex-start'
          },children:(0,L.jsx)(f.default,{
            onPress:()=>{ if ((initialActiveTool === 'demo_account' || oe === initialActiveTool) && onBack) { onBack(); } else { le(null); } },children:(0,L.jsx)(T.BlurView,{
              intensity:40,tint:e.blurTint,style:{
                flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:22,overflow:'hidden',backgroundColor:e.glassCard,borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
              },children:(0,L.jsx)(v.ArrowLeft,{
                color:e.text,size:18
              })
            })
          })
        }),ke&&(0,L.jsxs)(F.LinearGradient,{
          colors:['rgba(16,185,129,0.15)','rgba(16,185,129,0.05)'],style:{
            borderRadius:20,padding:24,marginBottom:24,borderWidth:1,borderColor:'#10B981',alignItems:'center'
          },children:[(0,L.jsx)(d.default,{
            style:{
              width:64,height:64,borderRadius:32,backgroundColor:'rgba(16,185,129,0.2)',justifyContent:'center',alignItems:'center',marginBottom:16
            },children:(0,L.jsx)(v.Check,{
              color:"#34D399",size:36
            })
          }),(0,L.jsx)(c.default,{
            style:{
              color:'#34D399',fontSize:22,fontWeight:'900',marginBottom:4
            },children:"Account Created!"
          }),(0,L.jsx)(c.default,{
            style:{
              color:'#6EE7B7',fontSize:14
            },children:"Your demo account is ready to trade"
          })]
        }),(0,L.jsxs)(d.default,{
          style:{
            backgroundColor:r?'#000000':'#FFFFFF',borderRadius:20,padding:16,marginBottom:24,borderWidth:1,borderColor:r?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'
          },children:[(0,L.jsxs)(d.default,{
            style:{
              flexDirection:'row',alignItems:'center'
            },children:[(0,L.jsx)(d.default,{
              style:{
                backgroundColor:r?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',padding:10,borderRadius:14,marginRight:16
              },children:(0,L.jsx)(v.UserPlus,{
                color:r?'#FFFFFF':'#000000',size:24
              })
            }),(0,L.jsxs)(d.default,{
              children:[(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:18,fontWeight:'bold'
                },children:"New Demo Account"
              }),(0,L.jsx)(c.default,{
                style:{
                  color:e.textMuted,fontSize:13,marginTop:2
                },children:"Risk-free practice trading"
              })]
            })]
          }),(0,L.jsx)(c.default,{
            style:{
              color:e.textMuted,fontSize:13,fontWeight:'700',marginBottom:8,letterSpacing:1,textTransform:'uppercase'
            },children:"Account Name"
          }),(0,L.jsx)(x.default,{
            style:{
              backgroundColor:r?'rgba(18,22,31,0.7)':'rgba(255,255,255,0.7)',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',borderRadius:16,padding:16,color:e.text,fontSize:16,fontWeight:'600',marginBottom:24
            },placeholder:"My Practice Account",placeholderTextColor:"#94A3B8",value:be,onChangeText:pe
          }),(0,L.jsx)(c.default,{
            style:{
              color:e.textMuted,fontSize:13,fontWeight:'700',marginBottom:12,letterSpacing:1,textTransform:'uppercase'
            },children:"Starting Balance"
          }),(0,L.jsxs)(d.default,{
            style:{
              alignItems:'center',marginBottom:20
            },children:[(0,L.jsxs)(c.default,{
              style:{
                color:e.text,fontSize:48,fontWeight:'900',letterSpacing:-1
              },children:['JPY'===Se?'\xa5':'GBP'===Se?'\xa3':'EUR'===Se?'\u20ac':'$',je.toLocaleString()]
            }),(0,L.jsxs)(c.default,{
              style:{
                color:e.textMuted,fontSize:13,fontWeight:'600',marginTop:4
              },children:["Virtual ",Se]
            })]
          }),(0,L.jsx)(g.default,{
            horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
              marginBottom:24
            },children:(0,L.jsx)(d.default,{
              style:{
                flexDirection:'row',gap:8
              },children:Gr.map(t=>(0,L.jsx)(f.default,{
                onPress:()=>Ce(t),style:{
                  paddingHorizontal:20,paddingVertical:12,borderRadius:14,backgroundColor:je===t?'rgba(249,115,22,0.2)':e.glassCard,borderWidth:1.5,borderColor:je===t?'#EA580C':r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:je===t?'#FB923C':'#94A3B8',fontSize:15,fontWeight:'800'
                  },children:t>=1e3?t/1e3+"K":t
                })
              },t))
            })
          }),(0,L.jsx)(c.default,{
            style:{
              color:e.textMuted,fontSize:13,fontWeight:'700',marginBottom:12,letterSpacing:1,textTransform:'uppercase'
            },children:"Base Currency"
          }),(0,L.jsx)(g.default,{
            horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
              marginBottom:24
            },children:(0,L.jsx)(d.default,{
              style:{
                flexDirection:'row',gap:8
              },children:Kr.map(t=>(0,L.jsx)(f.default,{
                onPress:()=>we(t),style:{
                  paddingHorizontal:20,paddingVertical:12,borderRadius:14,backgroundColor:Se===t?'rgba(59,130,246,0.2)':e.glassCard,borderWidth:1.5,borderColor:Se===t?'#3B82F6':r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:Se===t?'#60A5FA':'#94A3B8',fontSize:15,fontWeight:'800'
                  },children:t
                })
              },t))
            })
          }),(0,L.jsx)(c.default,{
            style:{
              color:e.textMuted,fontSize:13,fontWeight:'700',marginBottom:12,letterSpacing:1,textTransform:'uppercase'
            },children:"Leverage"
          }),(0,L.jsx)(g.default,{
            horizontal:!0,showsHorizontalScrollIndicator:!1,style:{
              marginBottom:28
            },children:(0,L.jsx)(d.default,{
              style:{
                flexDirection:'row',gap:8
              },children:Jr.map(t=>(0,L.jsx)(f.default,{
                onPress:()=>ze(t),style:{
                  paddingHorizontal:20,paddingVertical:12,borderRadius:14,backgroundColor:Be===t?'rgba(168,85,247,0.2)':e.glassCard,borderWidth:1.5,borderColor:Be===t?'#A855F7':r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
                },children:(0,L.jsx)(c.default,{
                  style:{
                    color:Be===t?'#C084FC':'#94A3B8',fontSize:15,fontWeight:'800'
                  },children:t
                })
              },t))
            })
          }),(0,L.jsx)(f.default,{
            onPress:qr,activeOpacity:.8,children:(0,L.jsx)(F.LinearGradient,{
              colors:['#EA580C','#F97316'],start:{
                x:0,y:0
              },end:{
                x:1,y:0
              },style:{
                paddingVertical:18,borderRadius:16,alignItems:'center',justifyContent:'center',shadowColor:'#EA580C',shadowOffset:{
                  width:0,height:8
                },shadowOpacity:.4,shadowRadius:16
              },children:(0,L.jsx)(c.default,{
                style:{
                  color:e.text,fontSize:17,fontWeight:'900',letterSpacing:.5
                },children:"Create Demo Account"
              })
            })
          })]
        }),(0,L.jsxs)(d.default,{
          style:{
            backgroundColor:r?'rgba(30,41,59,0.8)':'rgba(241,245,249,0.8)',borderRadius:20,padding:20,marginBottom:24,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:r?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
          },children:[(0,L.jsx)(d.default,{
            style:{
              backgroundColor:'rgba(59,130,246,0.15)',padding:10,borderRadius:12,marginRight:16
            },children:(0,L.jsx)(v.AlertCircle,{
              color:"#60A5FA",size:22
            })
          }),(0,L.jsx)(d.default,{
            style:{
              flex:1
            },children:(0,L.jsx)(c.default,{
              style:{
                color:e.textMuted,fontSize:13,lineHeight:20
              },children:"Demo accounts use virtual funds. Practice strategies, test ideas, and learn without risking real money."
            })
          })]
        }),Yr.length>0&&(0,L.jsxs)(d.default,{
          children:[(0,L.jsx)(c.default,{
            style:{
              color:e.text,fontSize:20,fontWeight:'900',marginBottom:16
            },children:"Your Demo Accounts"
          }),Yr.map(t=>(0,L.jsx)(O,{
            intensity:15,style:{
              padding:20,marginBottom:12
            },children:(0,L.jsxs)(d.default,{
              style:{
                flexDirection:'row',justifyContent:'space-between',alignItems:'center'
              },children:[(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',alignItems:'center'
                },children:[(0,L.jsx)(F.LinearGradient,{
                  colors:['#F59E0B','#D97706'],style:{
                    width:44,height:44,borderRadius:14,justifyContent:'center',alignItems:'center',marginRight:14
                  },children:(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontWeight:'900',fontSize:16
                    },children:"D"
                  })
                }),(0,L.jsxs)(d.default,{
                  children:[(0,L.jsx)(c.default,{
                    style:{
                      color:e.text,fontSize:16,fontWeight:'800'
                    },children:t.broker
                  }),(0,L.jsxs)(c.default,{
                    style:{
                      color:e.textMuted,fontSize:12,fontWeight:'600',marginTop:2
                    },children:["ID: ",t.id," \u2022 ",t.leverage||'1:100'," \u2022 ",t.currency||'USD']
                  })]
                })]
              }),(0,L.jsxs)(d.default,{
                style:{
                  alignItems:'flex-end'
                },children:[(0,L.jsxs)(c.default,{
                  style:{
                    color:'#FBBF24',fontSize:18,fontWeight:'900'
                  },children:['JPY'===t.currency?'\xa5':'GBP'===t.currency?'\xa3':'EUR'===t.currency?'\u20ac':'$',t.balance.toLocaleString()]
                }),(0,L.jsx)(f.default,{
                  onPress:()=>xe(t.id),style:{
                    marginTop:6,backgroundColor:'rgba(239,68,68,0.15)',paddingHorizontal:10,paddingVertical:4,borderRadius:8
                  },children:(0,L.jsx)(c.default,{
                    style:{
                      color:'#F87171',fontSize:10,fontWeight:'700'
                    },children:"Remove"
                  })
                })]
              })]
            })
          },t.id))]
        })]
      })]
    }),(0,L.jsx)(b.default,{
      visible:Xe,transparent:!0,animationType:"slide",children:(0,L.jsxs)(d.default,{
        style:o.modalOverlay,children:[(0,L.jsx)(f.default,{
          style:{
            flex:1
          },onPress:()=>et(!1)
        }),(0,L.jsxs)(T.BlurView,{
          intensity:40,tint:e.blurTint,style:o.modalContent,children:[(0,L.jsx)(d.default,{
            style:o.modalHandle
          }),(0,L.jsx)(c.default,{
            style:o.modalTitle,children:"Select Trading Account"
          }),(0,L.jsx)(c.default,{
            style:o.modalSubtitle,children:"All orders will be routed to the selected broker"
          }),nt.map(t=>{
            const r=lt.id===t.id;
            return(0,L.jsxs)(f.default,{
              activeOpacity:.8,onPress:()=>{
                at(t),et(!1)
              },style:[o.accountOption,{
                backgroundColor:e.glassCard,borderColor:e.glassBorder
              },r&&o.accountOptionSelected],children:[(0,L.jsxs)(d.default,{
                style:{
                  flexDirection:'row',alignItems:'center'
                },children:[(0,L.jsx)(d.default,{
                  style:[o.accountBadge,{
                    backgroundColor:'LIVE'===t.type?'rgba(16,185,129,0.2)':'rgba(245,158,11,0.2)'
                  }],children:(0,L.jsx)(c.default,{
                    style:[o.accountBadgeText,{
                      color:'LIVE'===t.type?'#34D399':'#FBBF24'
                    }],children:t.type
                  })
                }),(0,L.jsxs)(d.default,{
                  style:{
                    marginLeft:12
                  },children:[(0,L.jsx)(c.default,{
                    style:o.accountOptionBroker,children:t.broker
                  }),(0,L.jsxs)(c.default,{
                    style:o.accountOptionId,children:["cTID: ",t.id]
                  })]
                })]
              }),(0,L.jsxs)(d.default,{
                style:{
                  alignItems:'flex-end'
                },children:[(0,L.jsxs)(c.default,{
                  style:o.accountOptionBalance,children:["$",t.balance.toLocaleString()]
                }),r&&(0,L.jsx)(v.Check,{
                  color:"#3B82F6",size:18,style:{
                    marginTop:4
                  }
                })]
              })]
            },t.id)
          }),(0,L.jsx)(d.default,{
            style:{
              height:40
            }
          })]
        })]
      })
    })]
  })
}

export default function ToolsHubScreen({
   route = null, navigation = null, initialActiveTool = null, onBack = null, onActiveToolChange = null, isEmbedded = false
}) {
  const activeToolParam = route?.params?.initialActiveTool || route?.params?.subScreen || initialActiveTool;
  const hookNav = useNavigation();
  const backHandler = onBack || (() => {
      const nav = navigation || hookNav;
      if (nav) {
          if (typeof nav.canGoBack === 'function' && nav.canGoBack()) {
              nav.goBack();
          } else if (typeof nav.navigate === 'function') {
              nav.navigate('MainTabs', { screen: 'Watchlist' });
          }
      }
  });
  return ToolsHubInner(activeToolParam, backHandler, onActiveToolChange, isEmbedded);
}
