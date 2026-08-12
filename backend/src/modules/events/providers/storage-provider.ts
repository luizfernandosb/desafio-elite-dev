// Interface desde o primeiro commit -- trocar de fornecedor de storage passa a custar
// um arquivo novo, não uma reescrita do Service (mesmo raciocínio de CatalogProvider,
// etapa 04). Implementações: SupabaseStorageProvider (produção) e InMemoryStorageProvider
// (testes unitários do Service, sem rede).
export interface StorageProvider {
  upload(input: { buffer: Buffer; mimeType: string; folder: string }): Promise<{ url: string; key: string }>
  remove(key: string): Promise<void>
}
