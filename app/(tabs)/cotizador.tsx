// app/(tabs)/cotizador.tsx
import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { db } from '@/lib/supabase';
import { callCotizador, imageUriToBase64, generateRenderUrl } from '@/lib/api';
import { colors, spacing, radius } from '@/lib/theme';
import type { CotizacionSesion, Mensaje } from '@/types';

export default function CotizadorScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [sesionId, setSesionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [imagenesSeleccionadas, setImagenesSeleccionadas] = useState<string[]>([]);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Record<string, unknown> | null>(null);

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: async () => {
      // Convertir imágenes a base64
      const base64s: string[] = [];
      for (const uri of imagenesSeleccionadas) {
        const b64 = await imageUriToBase64(uri);
        base64s.push(b64);
      }

      // Agregar mensaje del usuario al chat local
      const msgUser: Mensaje = {
        id: Date.now().toString(),
        rol: 'user',
        contenido: input,
        imagenes: imagenesSeleccionadas,
        timestamp: new Date().toISOString(),
      };
      setMensajes(prev => [...prev, msgUser]);
      setInput('');
      setImagenesSeleccionadas([]);

      // Llamar al agente
      const result = await callCotizador({
        sesion_id: sesionId ?? undefined,
        mensaje: input,
        imagenes_base64: base64s,
        origen: 'app_zebrano',
      });

      if (result.ok) {
        // Guardar sesion_id si es nueva
        if (!sesionId) setSesionId(result.sesion_id);

        // Agregar respuesta del agente
        const msgAgent: Mensaje = {
          id: (Date.now() + 1).toString(),
          rol: 'agent',
          contenido: result.respuesta,
          timestamp: new Date().toISOString(),
        };

        // Si hay resumen, generar render
        if (result.resumen) {
          setResumen(result.resumen as Record<string, unknown>);
          // Generar render con Pollinations (gratis)
          const tipoTrabajo = mensajes.find(m => m.rol === 'user')?.contenido ?? 'furniture';
          const url = generateRenderUrl(tipoTrabajo);
          msgAgent.renderUrl = url;
          setRenderUrl(url);
        }

        setMensajes(prev => [...prev, msgAgent]);
        qc.invalidateQueries({ queryKey: ['sesiones-recientes'] });

        // Scroll al final
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
  });

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      setImagenesSeleccionadas(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Sin permiso', 'Necesitamos acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) setImagenesSeleccionadas(prev => [...prev, result.assets[0].uri]);
  }, []);

  const nuevaSesion = () => {
    setSesionId(null);
    setMensajes([]);
    setResumen(null);
    setRenderUrl(null);
    setInput('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.agentBadge}>
            <View style={styles.agentOrb} />
            <Text style={styles.agentLabel}>Zebrano AI</Text>
          </View>
          <TouchableOpacity onPress={nuevaSesion} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ Nueva</Text>
          </TouchableOpacity>
          {sesionId && (
            <TouchableOpacity onPress={() => router.push(`/cotizador/${sesionId}`)} style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>Ver detalle →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CHAT */}
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        >
          {mensajes.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◇</Text>
              <Text style={styles.emptyTitle}>Zebrano AI listo</Text>
              <Text style={styles.emptySub}>Describí el trabajo o subí una foto del plano</Text>
              <View style={styles.exampleBtns}>
                {['Placard 2 cuerpos melamina blanco', 'Cocina en L 3m × 2m', 'Biblioteca living roble'].map(ex => (
                  <TouchableOpacity key={ex} style={styles.exampleBtn} onPress={() => setInput(ex)}>
                    <Text style={styles.exampleText}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {mensajes.map((m) => (
            <View key={m.id} style={[styles.bubble, m.rol === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
              {m.rol === 'agent' && <Text style={styles.bubbleRole}>Zebrano AI</Text>}
              {m.imagenes?.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.bubbleImage} resizeMode="cover" />
              ))}
              <Text style={[styles.bubbleText, m.rol === 'user' && styles.bubbleTextUser]}>{m.contenido}</Text>
              {m.renderUrl && (
                <View style={styles.renderContainer}>
                  <Text style={styles.renderLabel}>✦ Render generado</Text>
                  <Image source={{ uri: m.renderUrl }} style={styles.renderImage} resizeMode="cover" />
                </View>
              )}
              <Text style={styles.bubbleTime}>{new Date(m.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}

          {isPending && (
            <View style={styles.bubbleAgent}>
              <Text style={styles.bubbleRole}>Zebrano AI</Text>
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.typingText}>Analizando...</Text>
              </View>
            </View>
          )}

          {/* RESUMEN si hay cotización */}
          {resumen && (
            <View style={styles.resumenCard}>
              <Text style={styles.resumenTitle}>◈ Resumen de cotización</Text>
              <ResumenRow label="Costo total interno" value={`$${Number(resumen.costoTotal ?? 0).toLocaleString('es-AR')}`} />
              <ResumenRow label="Precio sugerido al cliente" value={`$${Number(resumen.precioSugerido ?? 0).toLocaleString('es-AR')}`} accent />
              <ResumenRow label="Margen" value={`${resumen.margen ?? 35}%`} />
              <TouchableOpacity style={styles.resumenBtn} onPress={() => sesionId && router.push(`/cotizador/${sesionId}`)}>
                <Text style={styles.resumenBtnText}>Ver despiece completo y OT →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* IMÁGENES SELECCIONADAS */}
        {imagenesSeleccionadas.length > 0 && (
          <ScrollView horizontal style={styles.imageQueue} contentContainerStyle={{ gap: spacing.sm, padding: spacing.sm }}>
            {imagenesSeleccionadas.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={styles.queueImage} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setImagenesSeleccionadas(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Text style={{ color: '#fff', fontSize: 10 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* INPUT */}
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={takePhoto} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🖼</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Describí el trabajo o el módulo..."
            placeholderTextColor={colors.text3}
            multiline
            onSubmitEditing={() => !isPending && (input.trim() || imagenesSeleccionadas.length > 0) && enviar()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && imagenesSeleccionadas.length === 0) && styles.sendBtnDisabled]}
            onPress={() => enviar()}
            disabled={isPending || (!input.trim() && imagenesSeleccionadas.length === 0)}
          >
            {isPending ? <ActivityIndicator size="small" color={colors.bgDeep} /> : <Text style={styles.sendBtnText}>→</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ResumenRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: colors.text2, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: accent ? colors.amber : colors.text1, fontSize: 13, fontFamily: 'Syne_600SemiBold' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bgMid, borderBottomWidth: 1, borderBottomColor: colors.border },
  agentBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  agentOrb: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  agentLabel: { color: colors.gold, fontSize: 13, fontFamily: 'Syne_600SemiBold' },
  newBtn: { backgroundColor: colors.bgCard, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  newBtnText: { color: colors.text2, fontSize: 12 },
  detailBtn: { backgroundColor: `${colors.gold}20`, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.borderGold },
  detailBtnText: { color: colors.honey, fontSize: 12 },
  chat: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyIcon: { fontSize: 48, color: colors.gold },
  emptyTitle: { fontSize: 18, fontFamily: 'Syne_600SemiBold', color: colors.text1 },
  emptySub: { fontSize: 13, color: colors.text3, textAlign: 'center' },
  exampleBtns: { gap: spacing.sm, width: '100%', marginTop: spacing.md },
  exampleBtn: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  exampleText: { color: colors.text2, fontSize: 13, textAlign: 'center' },
  bubble: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, maxWidth: '90%' },
  bubbleUser: { backgroundColor: `${colors.teak}40`, alignSelf: 'flex-end', borderWidth: 1, borderColor: `${colors.teak}60` },
  bubbleAgent: { backgroundColor: colors.bgCard, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, maxWidth: '95%' },
  bubbleRole: { fontSize: 10, color: colors.gold, fontFamily: 'DMSans_400Regular', marginBottom: 4, letterSpacing: 1 },
  bubbleText: { color: colors.text2, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.text1 },
  bubbleImage: { width: '100%', height: 180, borderRadius: radius.sm, marginBottom: spacing.sm },
  bubbleTime: { fontSize: 9, color: colors.text3, marginTop: 6, alignSelf: 'flex-end', fontFamily: 'DMSans_400Regular' },
  renderContainer: { marginTop: spacing.sm, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderGold },
  renderLabel: { backgroundColor: `${colors.gold}15`, padding: 6, fontSize: 10, color: colors.gold, fontFamily: 'DMSans_400Regular' },
  renderImage: { width: '100%', height: 220 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: colors.text3, fontSize: 13 },
  resumenCard: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.borderGold, marginTop: spacing.md },
  resumenTitle: { color: colors.amber, fontSize: 13, fontFamily: 'Syne_600SemiBold', marginBottom: spacing.sm },
  resumenBtn: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  resumenBtnText: { color: colors.bgDeep, fontSize: 13, fontFamily: 'Syne_600SemiBold' },
  imageQueue: { maxHeight: 90, backgroundColor: colors.bgMid, borderTopWidth: 1, borderTopColor: colors.border },
  queueImage: { width: 72, height: 72, borderRadius: radius.sm },
  removeImage: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.red, borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bgMid, borderTopWidth: 1, borderTopColor: colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  iconBtnText: { fontSize: 18 },
  input: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderMid, color: colors.text1, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, backgroundColor: colors.gold, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.bgDeep, fontSize: 18, fontFamily: 'Syne_600SemiBold' },
});
